const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/billing_system', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Define Mongoose schema and models for products, services, users, and orders
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
});

const serviceSchema = new mongoose.Schema({
    name: String,
    price: Number,
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true, // Add this line to make the email field required
    },
      cart: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service',
        },
      ],
});

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    items: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
        },
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service',
        },
    ],
    totalBill: Number,
});

const Product = mongoose.model('Product', productSchema);
const Service = mongoose.model('Service', serviceSchema);
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);

// API endpoint to create an account
app.post('/users', async (req, res) => {
    const data = req.body;
    console.log(req.body);
    try {
        const user = new User(data);
        const savedUser = await user.save();
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

// API endpoint to fetch all products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching products' });
    }
});

// API endpoint to fetch all services
app.get('/services', async (req, res) => {
    try {
        const services = await Service.find({});
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching services' });
    }
});

// API endpoint to add a product or service to the cart


// ...

app.post('/users/:userId/cart', async (req, res) => {
    const { userId } = req.params;
    const { productId, serviceId } = req.body;

    console.log('userId:', userId);
    console.log('productId:', productId);
    console.log('serviceId:', serviceId);

    try {
        const user = await User.findById(userId);
        console.log('user:', user);

        if (productId && mongoose.isValidObjectId(productId)) {
            user.cart.push(productId);
        }
        if (serviceId && mongoose.isValidObjectId(serviceId)) {
            user.cart.push(serviceId);
        }

        const savedUser = await user.save();
        console.log('savedUser:', savedUser);
        res.json(savedUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating cart' });
    }
});





// API endpoint to remove a product or service from the cart
app.delete('/users/:userId/cart/:itemId', async (req, res) => {
    const { userId, itemId } = req.params;

    try {
        const user = await User.findById(userId);
        user.cart.pull(itemId);
        const savedUser = await user.save();
        res.json(savedUser);
    } catch (err) {
        res.status(500).json({ error: 'Error updating cart' });
    }
});

// API endpoint to clear the cart
app.delete('/users/:userId/cart', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        user.cart = [];
        const savedUser = await user.save();
        res.json(savedUser);
    } catch (err) {
        res.status(500).json({ error: 'Error clearing cart' });
    }
});

// API endpoint to view the total bill
app.get('/users/:userId/bill', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId).populate('cart');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let totalBill = 0;
        let itemsWithTax = [];

        for (const item of user.cart) {
            let itemPrice = item.price;
            let tax = 0;

            if (item instanceof Product) {
                if (itemPrice > 1000 && itemPrice <= 5000) {
                    tax = 0.12 * itemPrice;
                } else if (itemPrice > 5000) {
                    tax = 0.18 * itemPrice;
                } else {
                    tax = 200;
                }
            }  if (item instanceof Service) {
                if (itemPrice > 1000 && itemPrice <= 8000) {
                    tax = 0.10 * itemPrice;
                } else if (itemPrice > 8000) {
                    tax = 0.15 * itemPrice;
                } else {
                    tax = 100;
                }
            }

            itemsWithTax.push({
                name: item.name,
                price: item.price,
                tax,
                total: item.price + tax,
            });

            totalBill += item.price + tax;
        }

        res.json({ totalBill, itemsWithTax });
    } catch (err) {
        res.status(500).json({ error: 'Error finding user' });
    }
});

// API endpoint to confirm the order
app.post('/users/:userId/confirm-order', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId).populate('cart');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const orderItems = user.cart.length > 0 ?
            user.cart.map((item) => item._id) :
            [];
        const totalBill = user.cart.reduce((acc, item) => acc + item.price, 0);

        const order = new Order({
            user: userId,
            items: orderItems,
            totalBill,
        });

        const savedOrder = await order.save();

        user.cart = [];
        const savedUser = await user.save();

        res.json({ order: savedOrder, user: savedUser });
    } catch (err) {
        res.status(500).json({ error: 'Error confirming order' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
