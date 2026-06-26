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

    // ! 3. UPDATE USER BY AUTH ID (For Profile Page Save)

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

        // 👇 Update using authId
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

        // Fetch the updated user to return to frontend
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
