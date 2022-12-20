import express from 'express';
import fetch from 'node-fetch';
import { client_id } from './secrets.mjs';
import { client_secret } from './secrets.mjs';
globalThis.fetch = fetch;

const app = express();

class Song {
    constructor(artist, name, popularity, spotify_id){
        this.artist = artist,
        this.name = name,
        this.popularity = popularity
        // this.spotify_id = spotify_id
    }
};

class Party {
    constructor(name, voting, tracklist, dateOfCreation, isActive){
        this.name = name;
        this.voting = [];
        this.tracklist = [];
        this.dateOfCreation = Date.now();
        this.isActive = true;
    }
}

let events = [];

var token = ""; 
var timeStamp = 0; 
var LIMIT = 10;

const admin = {username:"admin",password:"secret"};

app.use(express.json());

// MAKE NEW EVENT (body requires: password, username, name)
app.post('/events', (req, res) => {
    if(authorizer(req.body.username, req.body.password)){
        let newParty = new Party(req.body.name);
        events.push(newParty);
        res.status(201).send("OK");
    } else {
        res.status(405).send("You don't seem to be authorized for this action.");
    };
});

// DISPLAY ALL EVENTS
app.get('/events', (req, res) => {
    let allEventNames = [];
    events.forEach(a => allEventNames.push({name: a.name, isActive: a.isActive}));
    res.json(allEventNames);
    res.status(200);
});

// DISPLAY EVENT INFO
app.get('/events/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    if(eventId < 0 || events.length <= eventId){
        res.status(404).send("Event Does Not Exist...");
    } else {
        res.send(events[eventId]);
    };
});

// SEARCH A SONG (query: localhost:xxxx/songs/irgendeinname)
app.get('/songs/:name', async (req, res) => {
    const track = req.params.name;
    const result = await searchTrack(track);
    res.json(result);
});

// VOTE FOR EXISTING SONG (body requires: eventId (starts from 0), songId (starts from 0))
app.put('/songs', (req, res) => {
    const eventId = req.body.eventId;
    const songId = req.body.songId;

    if(eventId < 0 || events.length <= eventId) {
        res.status(404).send("Event Does Not Exist...");
    } else if(songId < 0 || events[eventId].voting.length <= songId) {
        res.status(404).send("Song Does Not Exist...");
    } else if(events[eventId].isActive == false){
        res.status(403).send("Event Is Not Active Anymore...")
    } else {
        events[eventId].voting[songId].popularity++;
        events[eventId].voting = events[eventId].voting.sort(({popularity : a}, {popularity : b}) => b - a);
        res.send(`Successfully voted for ${events[eventId].voting[songId].name}
                  by ${events[eventId].voting[songId].artist}!`);
    };
});

// ADD NEW SONG (body requries: eventId, artist, title)
app.post('/songs', (req, res) => {
    let eventId = req.body.eventId;
    if(eventId < 0 || events.length <= eventId) {
        res.status(404).send("Event Does Not Exist...");
    };
    let artist = req.body.artist;
    let title = req.body.title;
    let newSong = new Song(artist, title, 1);
    events[eventId].voting.push(newSong);
    res.status(201).send(`Successfully added ${title} by ${artist}!`);
});

// DELETES SONG FROM VOTING AND ADDS IT TO TRACKLIST (body requires: username, password, eventId, songId)
app.put('/delete/songs', (req, res) => {
    let eventId = req.body.eventId;
    let songId = req.body.songId;

    if(authorizer(req.body.username, req.body.password)){
        if(songId > events[eventId].voting.length){
            res.status(404).send("This song or event does not exist.");
        } else {
            let newSong = new Song(events[eventId].voting[songId].artist, 
                                    events[eventId].voting[songId].name,
                                    events[eventId].voting[songId].popularity)
            events[eventId].voting.splice(songId, 1);
            events[eventId].tracklist.push(newSong);
            res.status(200).send(`Successfully deleted ${newSong.name} by ${newSong.artist}!`)
        }
    } else {
        res.status(405).send("You don't seem to be authorized for this action.")
    };
});

// CHANGES EVENT TO INACTIVE (body requires: username, password, eventId)
app.put('/edit', (req, res) => {
    let eventId = req.body.eventId;
    if(authorizer(req.body.username, req.body.password)){
        if(eventId > events.length){
            res.status(404).send("This event does not exist.");
        } else {
            events[eventId].isActive = false;
        }
    } else {
        res.status(405).send("You don't seem to be authorized for this action.");
    };
});

// SERVER
app.listen(3000, () => {
    // initTest();
    console.log('Schau mal auf localhost:3000/');
}); 

function initTest(){
    let newSong = new Song("Testinggg", "123Testtt", 3);
    let newSong2 =  new Song("hi from inittest2", "uwabowagawabow", 7);
    let newEvent = new Party("Very Cool Party for Testers");
    newEvent.voting.push(newSong);
    newEvent.voting.push(newSong2);
    events.push(newEvent);
    // console.log(newEvent.voting)
}

function fetchToken(){
    let promise = new Promise(function (resolve, reject) {
    fetch('https://accounts.spotify.com/api/token', {
        method: "POST",
        body: 'grant_type=client_credentials&client_id=' + client_id + '&client_secret=' + client_secret,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then((response) => {
        if(response.ok){
            timeStamp = Date.now()
            resolve(response.json());
        } else {
            reject("Looks like something went wrong.");
        }
    })
    });
    return promise;
};

function getToken(){
    let promise = new Promise(function(resolve, reject) {
        if((Date.now() - timeStamp) > 600000){
            fetchToken()
            .then((result) => {
                token = result.access_token;
                resolve(token);
            })
            .catch((error) => console.log(error))
        } else {
            resolve(token);
        }
    })
    return promise;
};

async function searchTrack(track){
    var token = await getToken();
    return new Promise(function(resolve, reject) {
        fetch(("https://api.spotify.com/v1/search?q=" + track + "&type=track&limit=" + LIMIT), { 
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                }
            })
            .then(response => response.json())
            .then(json => {
                let allResults = [];
                for(let i = 0; i < LIMIT; i++){
                    allResults.push(new Song(json.tracks.items[i].artists[0].name, json.tracks.items[i].name, 1))
                };
                resolve(allResults);
    })
});
};

function authorizer(username, password){
    if((username == admin.username) && (password == admin.password)){
        return true;
    } else return false;
}