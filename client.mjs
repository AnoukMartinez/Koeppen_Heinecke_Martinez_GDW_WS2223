import fetch from 'node-fetch'
import * as readline from 'node:readline';
import { client_id } from './secrets.mjs'
import { client_secret } from './secrets.mjs'
globalThis.fetch = fetch
const app = express();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

var token = ""; 
var timeStamp = 0; 
var LIMIT = 10; 

class Song {
    constructor(name, artist, popularity, spotify_id){
        this.name = name,
        this.artist = artist,
        this.popularity = popularity
        // this.spotify_id = spotify_id
    }
};

class Party {
    constructor(name, voting, tracklist, dateOfCreation, isActive){
        this.name = name,
        this.voting = [],
        this.tracklist = [],
        this.dateOfCreation = Date.now()
    }
}

function simpleReadLine(question){
    return new Promise(function(resolve, reject){
        rl.question(question, function(answer){
            resolve(answer);
        })
    })
}

function makeParty(name){
    fetch('http://localhost:3000/create/' + name, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
}

async function getUserPick(allResults, userPick){ // todo: while schleife
    if(userPick <= LIMIT && userPick > 0){
        return allResults[userPick];
    }
    // else invalid number please try again
}

function searchTrack(query){
    fetch('http://localhost:3000/create/' + name, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
};

function getEvent(eventId){ // also gets voting and tracklist
    fetch('http://localhost:3000/events/' + eventId, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
};

function getEvents(){
    fetch('http://localhost:3000/events', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
};

function voteTrack(eventId, trackId){
    fetch('http://localhost:3000/events/' + eventId + '/vote/' + trackId, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    })
};

function addTrack(eventId, artist, title){
    fetch('http://localhost:3000/events/' + eventId + '/add/' + artist + '/' + title, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
};