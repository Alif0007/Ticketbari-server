const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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



        const myDB = client.db("Ticketbari");
        // const users = myDB.collection("user");
        const col = (name) => myDB.collection(name);



        // app.post('/users', async (req, res) => {
        //     const newBook = req.body
        //     const result = await users.insertOne(newBook);
        //     res.send(result);
        // })

        app.post('/users', async (req, res) => {
            const user = req.body;
            if (!user?.email) return res.status(400).json({ message: 'Email required' });
            const exists = await col('users').findOne({ email: user.email });
            if (exists) return res.json(exists);
            user.role = user.role || 'user';
            user.createdAt = new Date();
            const result = await col('users').insertOne(user);
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const users = await col('users').find().toArray();
            res.send(users);
        });

        app.patch('/users/:email/role', async (req, res) => {
            const { role } = req.body;
            const result = await col('users').updateOne({ email: req.params.email }, { $set: { role } });
            res.send(result);
        });


        // -------------------- TICKETS --------------------
        app.post('/tickets', async (req, res) => {
            const ticket = req.body;
            // ticket.vendorEmail = req.user.email;
            if (ticket.perks && ticket.perks.length === 0) {
                ticket.perks = ["none"];
            }
            ticket.status = 'pending';
            ticket.advertised = false;
            ticket.createdAt = new Date();
            const result = await col('tickets').insertOne(ticket);
            res.send(result);
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
                .find({ verificationStatus: 'approved' })
                .sort(sortQuery)


                .toArray();

            const total = await col('tickets').countDocuments(query);
            res.send({ total, data });

        });

        app.get('/latest-tickets', async (req, res) => {

            const data = await col('tickets')
                .find({ verificationStatus: 'approved', })
                .sort({ createdAt: -1 }).limit(6)
                .toArray();

            res.send({ data });

        });


        app.get('/advertise-tickets', async (req, res) => {

            const data = await col('tickets')
                .find({

                    advertised: true
                })
                .sort({ createdAt: -1 })
                .toArray();

            res.send({ data });

        });


        app.get('/tickets/:id', async (req, res) => {
            const ticket = await col('tickets').findOne({ _id: new ObjectId(req.params.id) });
            res.send(ticket);
        });

        app.patch('/tickets/:id', async (req, res) => {
            const ticket = await col('tickets').findOne({ _id: new ObjectId(req.params.id) });
            if (!ticket) return res.status(404).json({ message: 'Not found' });
            if (ticket.vendorEmail !== req.user.email && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const result = await col('tickets').updateOne({ _id: ticket._id }, { $set: req.body });
            res.send(result);
        });

        app.delete('/tickets/:id', async (req, res) => {
            const ticket = await col('tickets').findOne({ _id: new ObjectId(req.params.id) });
            if (!ticket) return res.status(404).json({ message: 'Not found' });
            // if (ticket.vendorEmail !== req.user.email && req.user.role !== 'admin') {
            //     return res.status(403).json({ message: 'Forbidden' });
            // }
            const result = await col('tickets').deleteOne({ _id: ticket._id });
            res.send(result);
        });

        app.post("/bookings", async (req, res) => {
            const booking = req.body;

            booking.status = "pending";
            booking.createdAt = new Date();

            const result = await col('booking').insertOne(booking);

            res.send({
                success: true,
                message: "Booking request sent",
                insertedId: result.insertedId
            });
        });


        app.get('/tickets-advertise', async (req, res) => {




            const data = await col('tickets')
                .find({ advertised: true })



                .toArray();


            res.send(data);

        });

        // ---------------------------Vendor---------------

        app.get("/vendor-tickets", async (req, res) => {
            const { vendorEmail } = req.query;

            // Validation
            if (!vendorEmail) {
                return res.status(400).send({
                    success: false,
                    message: "vendorEmail query is required"
                });
            }

            const query = { vendorEmail };

            const tickets = await col('tickets')
                .find(query)
                .sort({ createdAt: -1 }) // latest first
                .toArray();

            res.send({
                success: true,
                count: tickets.length,
                data: tickets
            });
        });

        app.get("/vendor/bookings", async (req, res) => {
            const { vendorEmail } = req.query;

            const bookings = await col('booking').find({
                vendorEmail

            }).toArray();

            res.send(bookings);
        });

        app.patch("/bookings/:id", async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            const result = await col('booking').updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            res.send(result);
        });


        // ---------Admin---------

        app.get("/admin/tickets", async (req, res) => {
            const tickets = await col('tickets').find().toArray();
            res.send(tickets);
        });


        app.patch("/admin/tickets/:id", async (req, res) => {
            const { id } = req.params;

            const { verificationStatus } = req.body;

            const result = await col('tickets').updateOne(
                { _id: new ObjectId(id) },
                { $set: { verificationStatus } }
            );

            res.send(result);
        });


        app.patch("/admin/tickets/advertise/:id", async (req, res) => {
            const count = await col('tickets').countDocuments({ advertised: true });
            if (count >= 6) {
                return res.status(400).send({ message: "Maximum 6 advertised tickets allowed" });
            }
            console.log(count)
            const id = new ObjectId(req.params.id);
            const { advertised } = req.body
            const result = await col('tickets').updateOne(
                { _id: id },
                { $set: { advertised } }
            );
            res.send(result);
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello Worldsdaaaaaaaaaa!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})