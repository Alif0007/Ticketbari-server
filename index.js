const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');


const port = process.env.PORT || 3000

// Middleware

app.use(express.json())
app.use(cors())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@book-shelf.ixjlonr.mongodb.net/?appName=Book-Shelf`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// -------------------- USERS --------------------
app.post('/users', async (req, res) => {
    const user = req.body;
    if (!user?.email) return res.status(400).json({ message: 'Email required' });
    const exists = await col('users').findOne({ email: user.email });
    if (exists) return res.json(exists);
    user.role = user.role || 'user';
    user.createdAt = new Date();
    const result = await col('users').insertOne(user);
    res.json(result);
});


app.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
    const users = await col('users').find().toArray();
    res.json(users);
});


app.patch('/users/:email/role', verifyToken, requireRole('admin'), async (req, res) => {
    const { role } = req.body;
    const result = await col('users').updateOne({ email: req.params.email }, { $set: { role } });
    res.json(result);
});


// -------------------- TICKETS --------------------
app.post('/tickets', verifyToken, requireRole('vendor', 'admin'), async (req, res) => {
    const ticket = req.body;
    ticket.vendorEmail = req.user.email;
    ticket.status = 'pending';
    ticket.advertised = false;
    ticket.createdAt = new Date();
    const result = await col('tickets').insertOne(ticket);
    res.json(result);
});


app.get('/tickets', async (req, res) => {
    const { from, to, type, approved, sort, page = 1, limit = 6, advertised } = req.query;
    const query = {};
    if (from) query.from = new RegExp(from, 'i');
    if (to) query.to = new RegExp(to, 'i');
    if (type) query.transportType = type;
    if (approved === 'true') query.status = 'approved';
    if (advertised === 'true') query.advertised = true;


    let sortQuery = {};
    if (sort === 'price_asc') sortQuery.price = 1;
    if (sort === 'price_desc') sortQuery.price = -1;


    const skip = (Number(page) - 1) * Number(limit);
    const data = await col('tickets')
        .find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(Number(limit))
        .toArray();


    const total = await col('tickets').countDocuments(query);
    res.json({ total, data });
});





app.get('/', (req, res) => {
    res.send('Hello Worldsdaaaaaaaaaa!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})