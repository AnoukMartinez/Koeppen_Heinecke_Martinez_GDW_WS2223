import express from 'express';
import fetch from 'node-fetch';
import { client_id } from './secrets.mjs';
import { client_secret } from './secrets.mjs';
globalThis.fetch = fetch;

const app = express();

class Song {
    constructor(artist, name, popularity, spotify_id){
        this.name = name,
        this.artist = artist,
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

app.get('/', (req, res) => {
    
})

app.post('/create/:name', (req, res) => {
    const partyName = req.params.name
    let newParty = new Party(partyName);
    events.push(newParty);
    res.status(201).send("OK");
})

app.get('/events', (req, res) => {
    let allEventNames = [];
    events.forEach(a => allEventNames.push({name: a.name, isActive: a.isActive}))
    res.json(allEventNames);
    res.status(200);
})

app.get('/events/:eventId', (req, res) => {
    const eventId = req.params.eventId;
    if(eventId < 0 || events.length <= eventId){
        res.status(404).send("Event Does Not Exist... LOL!");
    } else {
        res.send(events[eventId]);
    }
})

app.get('/search/:name', async (req, res) => {
    const track = req.params.name
    const test = await searchTrack(track);
    res.json(test);
})

app.put('/events/:eventId/vote/:songId', (req, res) => {
    const eventId = req.params.eventId;
    const songId = req.params.songId;
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
    }
})

app.post('/events/:eventId/add/:artist/:title', (req, res) => {
    let eventId = req.params.eventId;
    if(eventId < 0 || events.length <= eventId) {
        res.status(404).send("Event Does Not Exist...");
    }
    let artist = req.params.artist;
    let title = req.params.title;
    let newSong = new Song(artist, title, 1);
    events[eventId].voting.push(newSong);
    res.status(201).send(`Successfully added ${title} by ${artist}!`)
})

app.listen(3000, () => {
    initTest();
    console.log('Schau mal auf localhost:3000/')
}); 

function initTest(){
    let newSong = new Song("Testinggg", "123Testtt", 3);
    let newSong2 =  new Song("Hahehu", "Hohoho", 7);
    let newEvent = new Party("Very Cool Party");
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
    })
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
})
};