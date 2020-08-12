const express = require('express');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cors = require('cors');
const knex = require('knex')
const Clarifai = require('clarifai');

const db = knex({
    client: 'pg',
    connection: {
        connectionString : process.env.DATABASE_URL,
        ssl: true
    }
});

const clarifaiApp = new Clarifai.App({
 apiKey: "7984e25844a446dcae9480384666be46"
});

const app = express();

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cors());


app.get('/', (req, res) => {
    res.send("Welcome")
})

app.post('/signin', (req, res) => {
    if(!req.body.email || !req.body.password) {
        return res.status(400).json('Incorrect form submission')
    }
    db.select('email', 'hash').from('login').where('email', '=', req.body.email)
    .then(data => {
        const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
        if(isValid) {
            return db.select('*').from('users').where('email', '=', req.body.email)
            .then(user => {
                res.json(user[0])
            })
            .catch(err => res.status(400).json('Unable to get User'))
        } else {
            res.status(400).json('Wrong Credentials!');
        }
    })
    .catch(err => res.status(400).json('Wrong credentials!'))
})

app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    if(!name || !email || !password) {
        return res.status(400).json('Incorrect form submission')
    }
    const hash = bcrypt.hashSync(password, saltRounds);
    console.log(hash)
    db.transaction(trx => {
        trx.insert({
            email: email,
            hash: hash
        })
        .into('login')
        .returning('email')
        .then(loginEmail => {
            return trx('users')
            .returning('*')
            .insert({
                email: loginEmail[0],
                name: name,
                joined: new Date()
            })
            .then(user => {
                console.log(user[0]);
                res.json(user[0]);
            })
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })

    .catch(err => {
        res.status(400).json('Unable to register')
    });
})

app.get('/profile/:id', (req, res) => {
    const id = req.params.id;
    db.select('*').from('users').where({
        id: id
    })
    .then(user => {
        console.log(user[0]);
        if(user.length) {
            res.json(user[0]);
        } else {
            res.status(400).json('Not found');
        }
    })
    .catch(err => res.status(400).json('Error'))
});


app.put('/image', (req, res) => {
    const id = req.body.id;
    console.log(id);
    db('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
        console.log(entries);
        res.json(entries[0])
    })
    .catch(err => res.status(400).json("Unable to increase entries"))
})

app.post('/imageurl', (req, res) => {
    if(req.body.input.startsWith("data")) {
        console.log(req.body.input)
        const base64 = req.body.input.slice(req.body.input.indexOf(',')+1,)
        clarifaiApp.models.predict(Clarifai.FACE_DETECT_MODEL, {base64: base64})
        .then(data => res.json(data))
        .catch(err => res.status(400).json('Unable to work with API'))
    } else {
        clarifaiApp.models.predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
        .then(data => res.json(data))
        .catch(err => res.status(400).json('Unable to work with API'))
    }
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3001;
}
app.listen(port, () => {
    console.log("Server has started successfully")
})
