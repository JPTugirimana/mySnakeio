
// Use ES6
"use strict";

var port = process.env.PORT || 1337;

// Express & Socket.io deps
var express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const _ = require('lodash');
var bodyParser = require('body-parser');

const Snake = require('./snake');
const Apple = require('./apple');

// Connect to the database
//-----------------------------

var mysql = require('mysql2');

var con = mysql.createConnection({
    host: "localhost",      
    user: "root",           // your username (such as mysql workbench username)
    password: "Admin@1",    // your password (such as mysql workbench password)
    database: "mydatabase"  // your database name
});

con.connect(function (err)
{
    if (err) throw err;

 var sql = "CREATE TABLE IF NOT EXISTS snakegame (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), password VARCHAR(255), highestScore INT)";

    con.query(sql, function (err, result) {
        if (err) throw err;
        console.log("Table created");
    });
});  
//---END of Database Connection

// ID's seed
let autoId = 0;

// Grid size
const GRID_SIZE = 40;

// Remote players 
let players = [];
// Apples 
let apples = [];


app.use(express.static("public"));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname);

app.use(bodyParser.urlencoded({ extended: true }));
//form-urlencoded

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/game', function (req, res) {
    var name = req.body.nickname;
    var highestScore = '';
    res.render('game.html', { Nickname: name, highestScore: highestScore });
}); 

// Login and signup routes
app.get('/login', function (req, res) {
    res.render('login.html', { error: '' });
});

app.post('/login', function (req, res) {
        var name = req.body.username;
        var password = req.body.password;

        var sql = "SELECT name, highestScore FROM snakegame WHERE name = ? AND password = ?";

        con.query(sql, [name, password], function (err, result)
        {
            if (err) throw err;

            if (result.length > 0)
            {
                var highestScore = result[0].highestScore;
                res.render('game.html', { Nickname: result[0].name, highestScore: highestScore });
            }
            else
            {
                res.render('login.html', { error: 'Wrong username or password.' });
            }  
        });  
});

app.post('/signup', function (req, res) {
    var name = req.body.username;
    var password = req.body.password;
    var confirm_password = req.body.confirm_password;

    if (password !== confirm_password) {
        res.render('signup.html', { error: "Passwords don't match" });
    }

    var sql = "SELECT name FROM snakegame WHERE name = ?";

    con.query(sql, [name], function (err, result) {
        if (err) throw err;  // check connection

        if (result.length > 0) {   // check if username is in the database
            res.render('signup.html', { error: 'Username already taken!' });
        }
        else {       
            var sql = "INSERT INTO snakegame (name, password, highestScore) VALUES ?";
            var highestScore = 0;
            var values = [[name, password, highestScore]];

            con.query(sql, [values], function (err, result) {
                if (err) throw err;
                console.log("Number of records inserted: " + result.affectedRows);
            });

            res.render('game.html', { Nickname: name, highestScore: highestScore });
        }
    });
}); 

app.get('/signup', function (req, res) {
    res.render('signup.html', { error: '' });
});


http.listen(port, () => {
    console.log('listening on *:3000');
});

/*
 * Listen for incoming clients
 */
io.on('connection', (client) => {
    let player;
    let id;
    let color;

    function getRandomColor() {
        var letters = '0123456789ABCDEF';
        var get_color = '#';
        for (var i = 0; i < 6; i++) {
            get_color += letters[Math.floor(Math.random() * 16)];
        }
        return get_color;
    }

    client.on('auth', (opts, cb) => {
        // Create player
        id = ++autoId;
        color = getRandomColor();
        player = new Snake(_.assign({
            id, color,
            dir: 'right',
            gridSize: GRID_SIZE,
            snakes: players,
            apples
        }, opts));
        players.push(player);
        // Callback with id
        cb({ id: autoId });
    });

    // Receive keystrokes
    client.on('key', (key) => {
        // and change direction accordingly
        if (player) {
            player.changeDirection(key);
        }
    });

    // Remove players on disconnect
    client.on('disconnect', () => {

        // record new score
        var name = player.nickname;

        var sql = "SELECT name, highestScore FROM snakegame WHERE name = ?";

        con.query(sql, [name], function (err, result) {
            if (err) throw err;  // check connection

            console.log(result[0].highestScore);
            if (result[0].highestScore < player.points) {   

                var sql = "UPDATE snakegame SET highestScore = ? WHERE name = ?";
                var newScore = player.points;

                con.query(sql, [newScore, name], function (err, result) {
                    if (err) throw err;
                    console.log(newScore);
                });
            }
        });

        _.remove(players, player);
    });


});

// Create apples
for (var i = 0; i < 3; i++) {
    apples.push(new Apple({
        gridSize: GRID_SIZE,
        snakes: players,
        apples
    }));
}

// Main loop
setInterval(() => {
    players.forEach((p) => {
        p.move();
    });
    io.emit('state', {
        players: players.map((p) => ({
            x: p.x,
            y: p.y,
            id: p.id,
            color: p.color,
            nickname: p.nickname,
            points: p.points,
            tail: p.tail
        })),
        apples: apples.map((a) => ({
            x: a.x,
            y: a.y
        }))
    });
}, 100);