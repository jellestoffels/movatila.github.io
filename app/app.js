require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const app = express();

const url = process.env.MONGODB_URI;
const dbName = 'datingApp';
let db;

MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;
  db = client.db(dbName);
  console.log("Connected to database");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/login', (req, res) => {
  const email = req.body.email;
  db.collection('users').findOne({ email, status: 'accepted' }, (err, user) => {
    if (err || !user) return res.send('User not found or not accepted.');
    const token = crypto.randomBytes(32).toString('hex');
    db.collection('tokens').insertOne({ email, token, createdAt: new Date() }, (err) => {
      if (err) return res.send('Error generating token.');
      const link = `http://localhost:3000/magic?token=${token}`;
      const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Login to Movatila',
        text: `Click here to login: ${link}`
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) return res.send('Error sending email.');
        res.send('Magic link sent!');
      });
    });
  });
});

app.get('/magic', (req, res) => {
  const token = req.query.token;
  db.collection('tokens').findOne({ token }, (err, doc) => {
    if (err || !doc) return res.send('Invalid token.');
    db.collection('users').findOne({ email: doc.email }, (err, user) => {
      if (err || !user) return res.send('User not found.');
      res.render('profile', { user });
    });
  });
});

app.get('/users', (req, res) => {
  db.collection('users').find({ status: 'accepted' }).toArray((err, users) => {
    if (err) return res.send('Error fetching users.');
    res.render('users', { users });
  });
});

app.get('/message/:id', (req, res) => {
  const userId = req.params.id;
  db.collection('users').findOne({ _id: new require('mongodb').ObjectID(userId) }, (err, user) => {
    if (err || !user) return res.send('User not found.');
    res.render('message', { user });
  });
});

app.post('/message/:id', (req, res) => {
  const userId = req.params.id;
  const message = {
    from: req.body.from,
    to: userId,
    content: req.body.content,
    createdAt: new Date()
  };
  db.collection('messages').insertOne(message, (err) => {
    if (err) return res.send('Error sending message.');
    res.send('Message sent!');
  });
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
