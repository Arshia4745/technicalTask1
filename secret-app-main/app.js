
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');


const port = process.env.PORT || 3000;


// Initial setup for the server:
const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize());
app.use(passport.session());



// Connect to a new MongoDB Database named 'userDB', using Mongoose ODM:
mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m5s9h.mongodb.net/userDB`);

// Create a new collection named 'users' to store the emails and passwords of the users:
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  facebookId: String,
  secrets: [{secret: String}]
})

// Add plugins to the userSchema before creating the User model:
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Create User model based on userSchema:
const User = new mongoose.model('User', userSchema);



// Configure passport-local strategy:
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});



// Configure passport-google-OAuth20 strategy:
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://secrets-basuabhirup.herokuapp.com/auth/google/secrets'
  },
  function(accessToken, refreshToken, profile, cb) {
    const id = profile.id;
    const userEmail = profile.emails[0].value;
    User.findOrCreate({ username: userEmail, googleId: id },
      (err, user) => {
      return cb(err, user);
    })
  }
))



// Configure passport-facebook Strategy:
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://secrets-basuabhirup.herokuapp.com/auth/facebook/secrets",
    profileFields: ['email']
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id },
      (err, user) => {
      return cb(err, user);
    });
  }
))



// Handle HTTP 'GET' requests:

// Handle 'GET' requests made on the '/' route:
app.get('/', (req, res) => {
  res.render('home');
})

// Handle 'GET' requests made on the '/auth/google' route:
app.get('/auth/google', passport.authenticate('google', {scope: ['profile', 'email'] }));

// Handle 'GET' requests made on the '/auth/google/secrets' route:
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/secrets');
  });

// Handle 'GET' requests made on the '/auth/facebook' route:
app.get('/auth/facebook', passport.authenticate('facebook'));

// Handle 'GET' requests made on the '/auth/facebook/secrets' route:
app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/secrets');
  })

// Handle 'GET' requests made on the '/register' route:
app.get('/register', (req, res) => {
  res.render('register');
})

// Handle 'GET' requests made on the '/login' route:
app.get('/login', (req, res) => {
  res.render('login');
})

// Handle 'GET' requests made on the '/secrets' route:
app.get('/secrets', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if(req.isAuthenticated()) {
    User.find({'secret': {$ne: null}}, (err, users) => {
      if(err) {
        console.log(err);
      } else {
        if (users) {
          res.render('secrets', {users: users});
        }
      }
    })
  } else {
    res.redirect('/login');
  }
})

// Handle 'GET' requests made on the '/submit' route:
app.get('/submit', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if(req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
})

// Handle 'GET' requests made on the '/logout' route:
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
})


// Handle HTTP 'POST' requests:

// Handle 'POST' requests made on the '/register' route:
app.post('/register', (req, res) => {
  User.register({username: req.body.username}, req.body.password, (err, user) => {
    if(err){
      res.send(`
        <h3 style="font-family:sans-serif; color:red;">${err.message}</h3>
        <button type="button" style="font-size:1rem; cursor:pointer;" onclick="window.location.href='/register'">Go back to Registration Page</buton>
        `);
    } else {
      passport.authenticate('local')(req, res, () => {
        res.redirect('/secrets');
      })
    }
  })
})

// Handle 'POST' requests made on the '/login' route:
app.post('/login', passport.authenticate('local', {
  successRedirect: '/secrets',
  failureRedirect: '/login',
}));

// Handle 'POST' requests made on the '/submit' route:
app.post('/submit',(req, res) => {
  User.findOne({ _id: req.user._id}, (err, user) => {
    if(err) {
      console.log(err);
    } else {
      if(user) {
        user.secrets.push({secret: req.body.secret});
        user.save(() => {
          res.redirect('/secrets')
        });
      }
    }
  })
})



// Enable client to listen to the appropriate port:
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
