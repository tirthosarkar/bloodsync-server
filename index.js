const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();

const uri = process.env.MONGO_DB_URI;

const app = express();
const cors = require('cors');

const port = process.env.PORT;
const DB = process.env.AUTH_DB_NAME;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db(DB);
    const usersCollection = database.collection('users');
    const userCollection = database.collection('user');

    const donationRequestsCollection = database.collection('donationRequests');

    // ! Users

    app.post('/api/users', async (req, res) => {
      try {
        console.log('🔥 USER API HIT');
        console.log(req.body);
        const user = req.body;

        const existingUser = await usersCollection.findOne({
          authId: user.authId,
        });

        if (existingUser) {
          return res.status(409).send({
            success: false,
            message: 'User already exists',
          });
        }

        const result = await usersCollection.insertOne(user);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
          message: 'User created successfully',
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET USER BY AUTH ID (For Profile Page)
    app.get('/api/users/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const user = await usersCollection.findOne({ authId: id });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: 'User not found - authId mismatch',
          });
        }

        res.status(200).send(user);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! 3. UPDATE USER BY AUTH ID ( for profile)

    app.patch('/api/users/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        // Prevent users from changing sensitive fields
        delete updateData._id;
        delete updateData.authId;
        delete updateData.email; // Email cannot be changed
        delete updateData.role; // Role cannot be changed by user
        delete updateData.status; // Status cannot be changed by user

        const result = await usersCollection.updateOne(
          { authId: id },
          { $set: updateData },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: 'User not found',
          });
        }

        const updatedUser = await usersCollection.findOne({ authId: id });

        res.status(200).send({
          success: true,
          message: 'Profile updated successfully',
          user: updatedUser,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! 4. CREATE DONATION REQUEST (✅ Fixed placement)

    app.post('/api/donation-requests', async (req, res) => {
      try {
        const requestData = req.body;
        console.log('Donation Request Received:', requestData);

        // 1. Validate required fields
        const requiredFields = [
          'requesterId',
          'recipientName',
          'recipientDistrict',
          'recipientUpazila',
          'hospitalName',
          'fullAddress',
          'bloodGroup',
          'donationDate',
          'donationTime',
          'requestMessage',
        ];
        for (const field of requiredFields) {
          if (!requestData[field]) {
            return res.status(400).send({
              success: false,
              message: `${field} is required`,
            });
          }
        }

        // 2. Check if the requester is blocked
        const user = await usersCollection.findOne({
          authId: requestData.requesterId,
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: 'Requester user not found',
          });
        }

        if (user.status === 'blocked') {
          return res.status(403).send({
            success: false,
            message:
              'Your account is blocked. You cannot create donation requests.',
          });
        }

        // 3. Construct the new request document
        const newRequest = {
          ...requestData, // ✅ This automatically includes donorName/donorEmail if they are sent
          status: requestData.status || 'pending', // ✅ Allows 'inprogress' if sent, defaults to 'pending'
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // 4. Insert into MongoDB
        const result = await donationRequestsCollection.insertOne(newRequest);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
          message: 'Donation request created successfully',
        });
      } catch (error) {
        console.error('🔥 Donation Request Error:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET RECENT DONATION REQUESTS BY USER (For Donor Dashboard)

    app.get('/api/donation-requests/recent/:userId', async (req, res) => {
      try {
        const { userId } = req.params;

        // Query: Find all requests by this user, limit to 3, sort by newest first
        const requests = await donationRequestsCollection
          .find({ requesterId: userId })
          .sort({ createdAt: -1 }) // Newest first
          .limit(3) // Max 3 requests
          .toArray();

        res.status(200).send(requests);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET SINGLE DONATION REQUEST BY ID (For Edit Page)
    app.get('/api/donation-requests/:id', async (req, res) => {
      try {
        const { id } = req.params;

        // Validate ID
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid ID format',
          });
        }

        const request = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).send({
            success: false,
            message: 'Request not found',
          });
        }

        res.status(200).send(request);
      } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! UPDATE donation request (Donor donates / Requester marks as Done/Canceled)
    // app.patch("/api/donation-requests/:id", async (req, res) => {
    //   try {
    //     const { id, userId, role } = req.params;
    //     const { status, donorName, donorEmail } = req.body;

    //     if (!ObjectId.isValid(id)) {
    //       return res
    //         .status(400)
    //         .send({ success: false, message: "Invalid ID format" });
    //     }

    //     const request = await donationRequestsCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!request) {
    //       return res
    //         .status(404)
    //         .send({ success: false, message: "Request not found" });
    //     }

    //     // ── 🟢 CORE LOGIC FIX ──

    //     // 1. If the status is being changed to "inprogress" (A Donor is volunteering)
    //     if (status === "inprogress") {
    //       // ANY logged-in user can donate, EXCEPT the person who created it
    //       if (request.requesterId === userId) {
    //         return res.status(403).send({
    //           success: false,
    //           message: "You cannot donate to your own request.",
    //         });
    //       }

    //       // ✅ Allow the update
    //       const updateFields = {
    //         status,
    //         donorName,
    //         donorEmail,
    //         updatedAt: new Date(),
    //       };

    //       await donationRequestsCollection.updateOne(
    //         { _id: new ObjectId(id) },
    //         { $set: updateFields },
    //       );

    //       return res.status(200).send({
    //         success: true,
    //         message:
    //           "Donation confirmed! You have volunteered to donate blood.",
    //       });
    //     }

    //     // 2. If status is being changed to "done" or "canceled"
    //     // (Only the Requester or an Admin can do this)
    //     if (request.requesterId !== userId && role !== "admin") {
    //       return res.status(403).send({
    //         success: false,
    //         message: "You are not authorized to update this request.",
    //       });
    //     }

    //     // 3. Perform the update for Requester/Admin changing to done/canceled
    //     const result = await donationRequestsCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       {
    //         $set: {
    //           status,
    //           updatedAt: new Date(),
    //         },
    //       },
    //     );

    //     res.status(200).send({
    //       success: true,
    //       message: `Status updated to ${status}`,
    //     });
    //   } catch (error) {
    //     console.error("🔥 PATCH Error:", error);
    //     res.status(500).send({
    //       success: false,
    //       message: error.message,
    //     });
    //   }
    // });

    // UPDATED BACKEND CODE
    app.patch('/api/donation-requests/:id', async (req, res) => {
      try {
        const { id } = req.params; // <--- ✅ Take ID from URL
        const { status, donorName, donorEmail, userId, role } = req.body; // <--- ✅ Take userId and role from BODY

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: 'Invalid ID format' });
        }

        const request = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res
            .status(404)
            .send({ success: false, message: 'Request not found' });
        }

        // ── 🟢 CORE LOGIC FIX ──

        // 1. If the status is being changed to "inprogress" (A Donor is volunteering)
        if (status === 'inprogress') {
          // ANY logged-in user can donate, EXCEPT the person who created it
          if (request.requesterId === userId) {
            return res.status(403).send({
              success: false,
              message: 'You cannot donate to your own request.',
            });
          }

          // ✅ Allow the update
          const updateFields = {
            status,
            donorName,
            donorEmail,
            updatedAt: new Date(),
          };

          await donationRequestsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateFields },
          );

          return res.status(200).send({
            success: true,
            message:
              'Donation confirmed! You have volunteered to donate blood.',
          });
        }

        // 2. If status is being changed to "done" or "canceled"
        // (Only the Requester or an Admin can do this)
        // if (request.requesterId !== userId && role !== "admin") {
        //   return res.status(403).send({
        //     success: false,
        //     message: "You are not authorized to update this request.",
        //   });
        // }

        // 3. Perform the update for Requester/Admin changing to done/canceled
        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          },
        );

        res.status(200).send({
          success: true,
          message: `Status updated to ${status}`,
        });
      } catch (error) {
        console.error('🔥 PATCH Error:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! for deleting request
    app.delete('/api/donation-requests/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { userId, role } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid ID format',
          });
        }

        const request = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).send({
            success: false,
            message: 'Request not found',
          });
        }

        // Owner or Admin only
        if (request.requesterId !== userId && role !== 'admin') {
          return res.status(403).send({
            success: false,
            message: 'You are not authorized to delete this request',
          });
        }

        const result = await donationRequestsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.status(200).send({
          success: true,
          message: 'Request deleted successfully',
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! EDIT (Update full details) donation request
    app.put('/api/donation-requests/edit/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { userId, role, ...updateData } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid ID format',
          });
        }

        const request = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).send({
            success: false,
            message: 'Request not found',
          });
        }

        // Owner or Admin only
        if (request.requesterId !== userId && role !== 'admin') {
          return res.status(403).send({
            success: false,
            message: 'You are not authorized to edit this request',
          });
        }

        // Prevent editing if already done or canceled
        if (request.status === 'done' || request.status === 'canceled') {
          return res.status(400).send({
            success: false,
            message: `Cannot edit a request that is already ${request.status}`,
          });
        }

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...updateData,
              updatedAt: new Date(),
            },
          },
        );

        res.status(200).send({
          success: true,
          message: 'Request updated successfully',
        });
      } catch (error) {
        console.error('Edit request error:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET ALL DONATION REQUESTS BY USER (With Filter & Pagination)

    app.get('/api/donation-requests/my-requests/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;

        // 1. Build the MongoDB Query
        const query = { requesterId: userId };
        if (status && status !== 'all') {
          query.status = status;
        }

        // 2. Calculate Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. Get the total count (for pagination metadata)
        const totalRequests =
          await donationRequestsCollection.countDocuments(query);

        // 4. Fetch the paginated data
        const requests = await donationRequestsCollection
          .find(query)
          .sort({ createdAt: -1 }) // Newest first
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        // 5. Send response with metadata
        res.status(200).send({
          success: true,
          data: requests,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalRequests / parseInt(limit)),
            totalRequests,
            limit: parseInt(limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET ALL PENDING DONATION REQUESTS (Public Page)

    app.get('/api/donation-requests', async (req, res) => {
      try {
        const requests = await donationRequestsCollection
          .find({ status: 'pending' })
          .sort({ createdAt: -1 }) // Newest first
          .toArray();

        res.status(200).send(requests);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET SINGLE DONATION REQUEST BY ID (For Details Page)

    app.get('/api/donation-requests/:id', async (req, res) => {
      try {
        const { id } = req.params;

        let objectId;
        try {
          // ✅ Wrap the ObjectId creation in a try/catch block
          objectId = new ObjectId(id);
        } catch (err) {
          // If the ID string is invalid for MongoDB, return 404 (Not Found)
          return res.status(404).send({
            success: false,
            message: 'Request not found',
          });
        }

        const request = await donationRequestsCollection.findOne({
          _id: objectId,
        });

        if (!request) {
          return res.status(404).send({
            success: false,
            message: 'Request not found',
          });
        }

        res.status(200).send(request);
      } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET DONORS BY SEARCH (Public Search Page)
    app.get('/api/donors/search', async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;

        // 1. Build dynamic filter query
        const filter = {};

        if (bloodGroup && bloodGroup !== 'all') {
          filter.bloodGroup = bloodGroup;
        }

        // ⚠️ CHANGE: Search by ID instead of Name (Your users store "district": "47")
        if (district && district !== 'all') {
          filter.district = district;
        }

        // ⚠️ CHANGE: Search by ID instead of Name
        if (upazila && upazila !== 'all') {
          filter.upazila = upazila;
        }

        // 2. Only show active donors (not blocked)
        filter.status = { $ne: 'blocked' };

        console.log('🔍 Search Query:', filter);

        // 3. Query MongoDB
        const donors = await usersCollection.find(filter).limit(50).toArray();

        // 4. Return the list
        res.status(200).send({
          success: true,
          count: donors.length,
          data: donors,
        });
      } catch (error) {
        console.error('🔥 Donor Search Error:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ! GET ALL USERS (Admin Only) with Pagination & Filter

    app.get('/api/admin/users', async (req, res) => {
      try {
        const { status, page = 1, limit = 10 } = req.query;

        // 1. Build the MongoDB Query
        const query = {};
        if (status && status !== 'all') {
          query.status = status;
        }

        // 2. Calculate Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 3. Get total count
        const totalUsers = await usersCollection.countDocuments(query);

        // 4. Fetch paginated users (exclude sensitive fields like password if present)
        const users = await usersCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.status(200).send({
          success: true,
          data: users,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / parseInt(limit)),
            totalUsers,
            limit: parseInt(limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    // ! UPDATE USER STATUS / ROLE (Admin Only) - CLEAN & RELIABLE VERSION
    // Import Better Auth at the top of your server.js (if not already imported)
    // const { auth } = require("../path/to/your/auth-config"); // Adjust path as needed

    // ! UPDATE USER STATUS / ROLE (Admin Only) - Using Better Auth API
    app.patch('/api/admin/users/:id', async (req, res) => {
      try {
        const { id } = req.params; // authId
        const { action } = req.body;

        console.log('🚀 Admin Action Received:', { authId: id, action });

        if (!action) {
          return res
            .status(400)
            .send({ success: false, message: 'Action is required' });
        }

        // 1. Determine the update based on the action
        let updateFields = {};

        if (action === 'block') {
          updateFields = { status: 'blocked' };
        } else if (action === 'unblock') {
          updateFields = { status: 'active' };
        } else if (action === 'makeVolunteer') {
          updateFields = { role: 'volunteer' };
        } else if (action === 'makeAdmin') {
          updateFields = { role: 'admin' };
        } else {
          return res
            .status(400)
            .send({ success: false, message: 'Invalid action provided' });
        }

        // 2. Update the 'users' collection (Your custom app data)
        const usersUpdateResult = await usersCollection.updateOne(
          { authId: id },
          {
            $set: updateFields,
            $unset: { action: '' },
          },
        );

        if (usersUpdateResult.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found in 'users' collection",
          });
        }
        console.log("✅ 'users' collection updated.");

        // 3. Update the 'user' collection using Better Auth API (Correct Way!)
        // 3. Update Better Auth 'user' collection directly by email
        const appUser = await usersCollection.findOne({ authId: id });
        if (appUser) {
          await userCollection.updateOne(
            { email: appUser.email },
            { $set: updateFields },
          );
          console.log("✅ 'user' (Better Auth) collection updated.");
        } else {
          console.warn("⚠️ User not found in Better Auth 'user' collection.");
        }

        // 4. Send success response
        const successMessage =
          action === 'block'
            ? 'blocked'
            : action === 'unblock'
              ? 'unblocked'
              : action === 'makeVolunteer'
                ? 'made a volunteer'
                : 'made an admin';

        res.status(200).send({
          success: true,
          message: `User ${successMessage} successfully!`,
        });
      } catch (error) {
        console.error('🔥 Admin PATCH Error:', error);
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
