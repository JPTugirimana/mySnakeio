
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
    res.render('game.html', { Nickname: name });
}); 

// Login and signup routes
app.get('/login', function (req, res) {
    res.sendFile(__dirname + '/login.html');
});

app.post('/login', function (req, res) {
   // res.sendFile(__dirname + '/login.html');
    var message = "errors";
    res.render('login.html', { error: message });
});

app.post('/signup', function (req, res) {
    //res.sendFile(__dirname + '/index.html');
}); 

app.get('/signup', function (req, res) {
    res.sendFile(__dirname + '/index.html');
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
        console.log(player.points);
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