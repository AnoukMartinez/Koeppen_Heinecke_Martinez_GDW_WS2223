import express from 'express';
import fetch from 'node-fetch';
import { client_id } from './secrets.mjs';
import { client_secret } from './secrets.mjs';
globalThis.fetch = fetch;

const app = express();

class DisplaySong {
    constructor(artist, title, song_id){
        this.artist = artist,
        this.title = title,
        this.song_id = song_id
    }
}

class Song {
    constructor(artist, title, popularity, song_id, artist_id, genre){
        this.artist = artist,
        this.title = title,
        this.popularity = popularity,
        this.song_id = song_id,
        this.artist_id = artist_id,
        this.genre = genre
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

class Admin {
    constructor(admin, username, password){
        this.type = "admin",
        this.username = username,
        this.password = password
    }
}

class User {
    constructor(admin, username, password){
        this.type = "user",
        this.username = username,
        this.password = password
    }
}

let events = [];

var token = ""; 
var timeStamp = 0; 
var LIMIT = 10;

let admins = [];
let users = [];

app.use(express.json());

// CREATES NEW USER OR ADMIN (body requires: type, username, password)
app.post('/users', (req, res) => {
    if(req.body.type == "admin"){
        let newAdmin = new Admin(req.body.admin, req.body.username, req.body.password);
        admins.push(newAdmin);
        res.status(201).send("New Admin has been created!");
    } else {
        let newUser = new User(req.body.admin, req.body.username, req.body.password);
        users.push(newUser);
        res.status(201).send("New User has been created!")
    }
})

// VIEWS ALL EXISTING USERS (body requires: username, password)
app.get('/users', (req, res) => {
    if(authorizer(req.body.username, req.body.password) == "admin"){
        let allProfiles = [];
        users.forEach(a => allProfiles.push({type: a.type, username: a.username, password: a.password}));
        admins.forEach(a => allProfiles.push({type: a.type, username: a.username, password: a.password}));
        res.json(allProfiles);
        res.status(200);
    } else {
        res.status(405).send("You don't seem to be authorized for this action.")
    }
})

// MAKE NEW EVENT (body requires: password, username, name)
app.post('/events', (req, res) => {
    if(authorizer(req.body.username, req.body.password) == "admin"){
        let newParty = new Party(req.body.name);
        events.push(newParty);
        res.status(201).send("Event has been created!");
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
app.get('/events/:eventIndex', (req, res) => {
    const eventIndex = req.params.eventIndex;
    if(eventIndex < 0 || events.length <= eventIndex){
        return res.status(404).send("Event Does Not Exist...");
    } 
    res.send(events[eventIndex]);
});

// SEARCH A SONG (query: localhost:xxxx/songs/irgendeinname)
app.get('/songs/:title', async (req, res) => {
    const track = req.params.title;
    const result = await searchTrack(track);
    res.json(result);
});

// VOTE FOR EXISTING SONG (body requires: eventIndex (starts from 0), songIndex (starts from 0), username, password)
app.put('/events/songs/vote', (req, res) => {
    const eventIndex = req.body.eventIndex;
    const songIndex = req.body.songIndex;
    let auth = authorizer(req.body.username, req.body.password);

    if(auth != "none"){
        if(eventIndex < 0 || events.length <= eventIndex) {
            return res.status(404).send("Event Does Not Exist...");
        } 
        if(songIndex < 0 || events[eventIndex].voting.length <= songIndex) {
            return res.status(404).send("Song Does Not Exist...");
        } 
        if(events[eventIndex].isActive == false){
            return res.status(403).send("Event Is Not Active Anymore...")
        } 
        events[eventIndex].voting[songIndex].popularity++;
        events[eventIndex].voting = events[eventIndex].voting.sort(({popularity : a}, {popularity : b}) => b - a);
        res.status(201).send(`Successfully voted for ${events[eventIndex].voting[songIndex].title} by ${events[eventIndex].voting[songIndex].artist}!`);
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.")
    }
});

// ADD NEW SONG (body requries: username, password, eventIndex, artist, title, song_id)
app.post('/events/songs', async (req, res) => {
    let auth = authorizer(req.body.username, req.body.password);

    if(auth != "none"){
        let eventIndex = req.body.eventIndex;
        if(eventIndex < 0 || events.length <= eventIndex) {
            return res.status(404).send("Event Does Not Exist...");
        }
        
        let song_id = req.body.song_id;
        let newSong = await getSongDetail(song_id);

        const exists = events[eventIndex].voting.findIndex(song => song.song_id == newSong.song_id);
        if(exists != -1){
            events[eventIndex].voting[exists].popularity++;
            res.status(200).send("This song already exists in the voting. We incremented the popularity for you!")
        } else {
            events[eventIndex].voting.push(newSong);
            res.status(201).send(`Successfully added ${newSong.title} by ${newSong.artist}!`);
        }
    } else {
        res.status(405).send("Your credentials don't match those of an existing account.")
    }
});

// DELETES SONG FROM VOTING AND ADDS IT TO TRACKLIST (body requires: username, password, eventIndex, songIndex)
app.put('/events/songs', (req, res) => {
    let eventIndex = req.body.eventIndex;
    let songIndex = req.body.songIndex;
    let auth = authorizer(req.body.username, req.body.password)

    if(auth == "admin"){
        if(eventIndex >= events.length || eventIndex < 0){
            return res.status(404).send("This event does not exist.");
        } 
        if(songIndex >= events[eventIndex].voting.length || songIndex < 0){
            return res.status(404).send("This song does not exist.");
        }

        let newSong = events[eventIndex].voting[songIndex]
        events[eventIndex].tracklist.push(newSong);
        events[eventIndex].voting.splice(songIndex, 1);
        
        res.status(200).send(`Successfully deleted ${newSong.title} by ${newSong.artist}!`)
        
    } else if(auth == "user") {
        res.status(405).send("You don't seem to be authorized for this action.");
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.")
    }
});

// CHANGES EVENT TO INACTIVE (body requires: username, password, eventIndex)
app.put('/events', (req, res) => {
    let eventIndex = req.body.eventIndex;
    let auth = authorizer(req.body.username, req.body.password)
    if(auth == "admin"){
        if(eventIndex > events.length){
            return res.status(404).send("This event does not exist.");
        } 

        events[eventIndex].isActive = false;
        res.status(201).send("Event has been successfully set to inactive.")
    
    } else if(auth == "user") {
        res.status(405).send("You don't seem to be authorized for this action.");
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.")
    }
});

app.get('/events/songs/recommendations/:eventIndex', async (req, res) => {
    let eventIndex = req.params.eventIndex;
    if(eventIndex > events.length || eventIndex < 0){
        return res.status(404).send("This event does not exist.")
    }
    if(events[eventIndex].voting.length == 0){
        return res.status(404).send("There are no entries yet to base recommendations on.")
    }

    const result = await getRecommendations(eventIndex);
    res.json(result);
})

// SERVER
app.listen(3000, () => {
    console.log('Schau mal auf localhost:3000/');
}); 

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
                    // console.log(json.tracks.items[i]);
                    allResults.push(new DisplaySong(json.tracks.items[i].artists[0].name, 
                                                    json.tracks.items[i].name, 
                                                    json.tracks.items[i].id))
                };
            resolve(allResults);
    })
});
};

async function getTrackDetail(song_id){
    var token = await getToken();
    return new Promise(function(resolve, reject) {
        fetch(('https://api.spotify.com/v1/tracks/' + song_id), {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            }
        }).then(response => response.json())
        .then(json => {
            let artist = json.artists[0].name;
            let title = json.name;
            let popularity = 1;
            let song_id = json.id;
            let artist_id = json.artists[0].id;
            let newSong = new Song(artist, title, popularity, song_id, artist_id);
            resolve(newSong);
        })
    })
}

async function getSongDetail(song_id){
    let newSong = await getTrackDetail(song_id);
    let genre = await getArtistGenre(newSong.artist_id);
    let finalSong = new Song(newSong.artist, newSong.title, newSong.popularity, newSong.song_id,
                                newSong.artist_id, genre);
    return finalSong;
}

async function getArtistGenre(artist_id){
    var token = await getToken();
    return new Promise(function(resolve, reject) {
        fetch(('https://api.spotify.com/v1/artists/' + artist_id), {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            }
        }).then(response => response.json())
        .then(json => {
            let genres = [];
            for(let i = 0; i < json.genres.length; i++){
                genres.push(json.genres[i]);
            }
            resolve(genres);        
        }) 
    })
}

// events/songs/recommendations

async function getRecommendations(eventIndex){
    var token = await getToken();

    let seed_artists = [];
    let seed_genres = [];
    let seed_tracks = [];

    // 5 Seeds Total (Interchangeable)
    for(let i=0;i < events[eventIndex].voting.length && i < 2;i++){
        seed_genres.push(events[eventIndex].voting[i].genre[0]);
        seed_artists.push(events[eventIndex].voting[i].artist_id);
    }

    seed_tracks.push(events[eventIndex].voting[0].song_id);
    seed_artists = seed_artists.join(",");
    seed_genres = seed_genres.join(",");   

    return new Promise(function(resolve, reject) {
        fetch(('https://api.spotify.com/v1/recommendations?seed_artists=' + seed_artists + '&seed_genres=' + seed_genres + '&seed_tracks=' + seed_tracks + '&limit=' + LIMIT), {
            method: "GET",
            headers: {
                "Authorization" : "Bearer " + token,
                "Content-Type" : "application/json"
            }
        }).then(response => response.json())
        .then(json => {
            let allRecommendations = [];

            for(let i = 0; i < LIMIT; i++){
                /* if(json.tracks[i] == undefined){
                    break;
                } */
                let recSong = new DisplaySong(json.tracks[i].artists[0].name, json.tracks[i].name, json.tracks[i].id);
                allRecommendations.push(recSong)
            }
            resolve(allRecommendations);
        })
    })
}

// let songDetailTest = await getSongDetail('0zv1grI5zKy2dxSu93unXc');
// console.log(songDetailTest);

function authorizer(username, password){
    const contains = (element) => (element.username == username) && (element.password == password);
    if(admins.some(contains)){
        return "admin";
    } else if(users.some(contains)){
        return "user";
    } else return "none"
}