
// Section 1 : Import Dependencies 

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object.
const bcrypt = require('bcryptjs'); //  To hash passwords

// Connect to DB 

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test database

db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// App Settings

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);


// API routes

app.get('/', (req, res) => {
  res.redirect('/login');
});


//login routes

app.get('/login', (req, res) => {
  res.render('pages/login')

});

app.post('/login', async (req, res) => {
  try {
        const user = await db.one(
            'SELECT * FROM users WHERE username = $1',
            [req.body.username]
        );
    console.log(user);
    if (user.username) {
          const match = await bcrypt.compare(req.body.password, user.password);
      if (!match) {
              res.render('pages/login', {
                  message: `Incorrect username or password`
                });
          }
      else {
        req.session.user = user;
        req.session.save();
        res.redirect('/home');
      }
    }
    else {
      res.redirect('/register');
    }
  }
  catch (err) {
    console.log(err)
    res.redirect('/register');
  }
});

// Register routes

app.get('/register', (req, res) => {
  res.render('pages/register')

});

app.post('/register', async (req, res) => {
  try {
    //hash the password using bcrypt library
    const hash = await bcrypt.hash(req.body.password, 10);

    // To-DO: Insert username and hashed password into the 'users' table
    await db.none('INSERT INTO users(username, password) VALUES($1, $2)', [req.body.username, hash]);
    res.redirect('/login');
    //if there is an error inserting such as there is already that user name and password then rederrect to the regiser page
    // error is turned to true so that message partial shows danger background color and message value is set to appropriate message
  } 
  catch (error) {
    res.render('pages/register', { message: 'Registration failed username password already exists', error: true });
  }
});

// logout

//reviews

app.get("/reviews", (req, res) => {

  res.render('pages/reviews')
});

app.get("/writeReview", (req, res) => {

  res.render('pages/writeReview')
});


//authentification
const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to login page.
    return res.redirect('/login');
  }
  next();
};

// code after this will be required to log in to get to
app.use(auth);

app.get("/home", (req, res) => {
  res.render('pages/home')
});

//Write Messages
app.post("/writeMessage", async (req, res) => {
  const { reciever_name, title, message_text } = req.body;

  if (message_text.length > 500) {
    console.log("Message text exceeds 500 characters");
    return res.status(400).send("Message text should not exceed 500 characters");
  }

  try {
    await db.none(
      'INSERT INTO messages (reciever_name, title, message_text) VALUES ($1, $2, $3)',
      [reciever_name, title, message_text]
    );

    res.send("Message written successfully");
  } catch (error) {
    if (error.code === '23505') { 
      res.status(400).send("A message with this title already exists for this receiver");
    } else {
      console.error("Error occurred:", error);
      res.status(500).send("An error occurred");
    }
  }
});



// start the server
app.listen(3000);
console.log('Server is listening on port 3000');