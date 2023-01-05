import express from 'express';
import fetch from 'node-fetch';
import { client_id } from './secrets.mjs';
import { client_secret } from './secrets.mjs';
import { createClient } from 'redis';
globalThis.fetch = fetch;

const client = createClient({
    url: process.env.redis_url
});
client.on('error', (err) => console.log('Redis Client Error', err));
await client.connect();

const app = express();
app.use(express.json());

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

class DisplayEventSong {
    constructor(index, artist, title, popularity, genre){
        this.index = index,
        this.artist = artist,
        this.title = title,
        this.popularity = popularity,
        this.genre = genre
    }
}

class DisplayParty {
    constructor(name, dateOfCreation, isActive){
        this.name = name;
        this.dateOfCreation = dateOfCreation;
        this.isActive = isActive;
    }
}

class Party {
    constructor(name, voting, tracklist, dateOfCreation, isActive){
        this.name = name;
        this.voting = voting;
        this.tracklist = tracklist;
        this.dateOfCreation = dateOfCreation;
        this.isActive = isActive;
    }
}

class User {
    constructor(type, username, password){
        this.type = type,
        this.username = username,
        this.password = password
    }
}

var token = ""; 
var timeStamp = 0; 
var LIMIT = 10;

// CREATES NEW USER OR ADMIN (body requires: type, username, password)
app.post('/users', async(req, res) => {
    if(req.body.type == "admin"){
        let newAdmin = new Admin(req.body.admin, req.body.username, req.body.password);
        await client.json.set('admins', '.' + newAdmin.username, {"password":newAdmin.password});
        res.status(201).send("New Admin has been created!");
    } else {
        let newUser = new User(req.body.admin, req.body.username, req.body.password);
        await client.json.set('users', '.' + newUser.username, {"password":newUser.password});
        // send error if redis fails
        res.status(201).send("New User has been created!")
    }
})

// VIEWS ALL EXISTING USERS (body requires: username, password)
app.get('/users', async (req, res) => {
    if(await authorizer(req.body.username, req.body.password) == "admin"){
        let admins = await client.json.get('admins');
        let users = await client.json.get('users');
        let allUsers = []
        for (const key in admins) {
            allUsers.push(new User("admin", key, admins[key].password));
        }
        for (const key in users) {
            allUsers.push(new User("user", key, users[key].password));
        }
        res.json(allUsers);
        res.status(200);
    } else {
        res.status(405).send("You don't seem to be authorized for this action.")
    }
})

// MAKE NEW EVENT (body requires: password, username, name)
app.post('/events', async (req, res) => {
    const auth = await authorizer(req.body.username, req.body.password);
    if(auth == "admin"){
        let newParty = new Party(req.body.name, [], [], Date.now(), true);
        await client.json.ARRAPPEND('events', '$', newParty);
        res.status(201).send("Event has been created!");
    } else {
        res.status(405).send("You don't seem to be authorized for this action.");
    };
});

// DISPLAY ALL EVENTS
app.get('/events', async (req, res) => {
    let events = await client.json.get('events');
    let allEvents = []

    events.forEach(function(item) {
        allEvents.push(new DisplayParty(item.name, item.dateOfCreation, item.isActive));
    })
    
    res.json(allEvents);
    res.status(200);
});

// DISPLAY EVENT INFO
app.get('/events/:eventIndex', async (req, res) => {
    const eventIndex = req.params.eventIndex;
    // const event = await client.json.get('events', `$..[${eventIndex}]`);
    try {
        let event = await client.json.get('events', {path: [`.[${eventIndex}]`]});
        let displayVoting = [];
        let i = 0;
        event.voting.forEach(function(element) {
            displayVoting.push(new DisplayEventSong(i, element.artist, element.title, 
                                                    element.popularity, element.genre));
            i++;
        })

        event.voting = displayVoting.sort(({popularity : a}, {popularity : b}) => b - a);
        return res.send(event)
    } catch {
        return res.status(404).send("Event Does Not Exist...");
    }
});

// SEARCH A SONG (query: localhost:xxxx/songs/irgendeinname)
app.get('/songs/:title', async (req, res) => {
    const track = req.params.title;
    const result = await searchTrack(track);
    res.json(result);
});

// VOTE FOR EXISTING SONG (body requires: eventIndex (starts from 0), songIndex (starts from 0), username, password)
app.put('/events/songs/vote', async (req, res) => {
    const eventIndex = req.body.eventIndex;
    const songIndex = req.body.songIndex;
    let currEvent;
    let auth = await authorizer(req.body.username, req.body.password);

    if(auth != "none"){
        try {
            currEvent = await client.json.get('events', {path: [`.[${eventIndex}]`]});
        } catch {
            return res.status(404).send("Event Does Not Exist...");
        }
        
        if(songIndex < 0 || currEvent.voting.length <= songIndex) {
            return res.status(404).send("Song Does Not Exist...");
        } 
        if(currEvent.isActive == false){
            return res.status(403).send("Event Is Not Active Anymore...")
        }

        await client.json.set('events', `$[${eventIndex}].voting[${songIndex}].popularity`, ++currEvent.voting[songIndex].popularity);
        res.status(201).send(`Successfully voted for ${currEvent.voting[songIndex].title} by ${currEvent.voting[songIndex].artist}!`);
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.")
    }
});

// ADD NEW SONG (body requries: username, password, eventIndex, song_id)
app.post('/events/songs', async (req, res) => {
    let auth = await authorizer(req.body.username, req.body.password);

    if(auth != "none"){
        let eventIndex = req.body.eventIndex;
        let currEvent;
        try {
            currEvent = await client.json.get('events', {path: [`.[${eventIndex}]`]});
        } catch {
            return res.status(404).send("Event Does Not Exist...");
        }

        if(!currEvent.isActive){
            return res.status(403).send("Event Is Not Active Anymore...");
        }
        
        let song_id = req.body.song_id;
        let newSong = await getSongDetail(song_id);

        const exists = currEvent.voting.findIndex(song => song.song_id == newSong.song_id);
        if(exists != -1){
            await client.json.set('events', `$[${eventIndex}].voting[${exists}].popularity`, ++currEvent.voting[exists].popularity);
            res.status(200).send("This song already exists in the voting. We incremented the popularity for you!")
        } else {
            await client.json.ARRAPPEND('events', `$[${eventIndex}].voting`, newSong);
            res.status(201).send(`Successfully added ${newSong.title} by ${newSong.artist}!`);
        }
    } else {
        res.status(405).send("Your credentials don't match those of an existing account.")
    }
});

// DELETES SONG FROM VOTING AND ADDS IT TO TRACKLIST (body requires: username, password, eventIndex, songIndex)
app.put('/events/songs', async (req, res) => {
    let eventIndex = req.body.eventIndex;
    let songIndex = req.body.songIndex;
    let auth = await authorizer(req.body.username, req.body.password)
    let currEvent;

    if(auth == "admin"){
        try {
            currEvent = await client.json.get('events', {path: [`.[${eventIndex}]`]});
        } catch {
            return res.status(404).send("This event does not exist.");
        }

        if(songIndex >= currEvent.voting.length || songIndex < 0){
            return res.status(404).send("This song does not exist.");
        }

        let newSong = currEvent.voting[songIndex];
        await client.json.ARRAPPEND('events', `$[${eventIndex}].tracklist`, newSong);
        await client.json.ARRPOP('events', `$[${eventIndex}].voting`, songIndex);
        
        res.status(201).send(`Successfully deleted ${newSong.title} by ${newSong.artist}!`)
        
    } else if(auth == "user") {
        res.status(405).send("You don't seem to be authorized for this action.");
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.")
    }
});

// CHANGES EVENT TO INACTIVE (body requires: username, password, eventIndex)
app.put('/events', async (req, res) => {
    let eventIndex = req.body.eventIndex;
    let auth = await authorizer(req.body.username, req.body.password)
    if(auth == "admin"){
        try {
            await client.json.set('events', `$[${eventIndex}].isActive`, false)
            return res.status(201).send("Event has been successfully set to inactive.")
        } catch {
            return res.status(404).send("This event does not exist.");
        }
    } 
    if(auth == "user") {
        return res.status(405).send("You don't seem to be authorized for this action.");
    } 
    return res.status(405).send("Your credentials don't match those of an existing user.")
});

// GETS RECOMMENDATIONS
app.get('/events/songs/recommendations/:eventIndex', async (req, res) => {
    let eventIndex = req.params.eventIndex;
    let currEvent;
    try {
        currEvent = await client.json.get('events', {path: [`.[${eventIndex}]`]});
    } catch {
        return res.status(404).send("This event does not exist.");
    }
    if(currEvent.voting.length == 0){
        return res.status(404).send("There are no entries yet to base recommendations on.")
    }

    const result = await getRecommendations(currEvent.voting);
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

async function getRecommendations(voting){
    var token = await getToken();

    let seed_artists = [];
    let seed_genres = [];
    let seed_tracks = [];

    // 5 Seeds Total (Interchangeable)
    for(let i=0;i < voting.length && i < 2;i++){
        seed_genres.push(voting[i].genre[0]);
        seed_artists.push(voting[i].artist_id);
    }

    seed_tracks.push(voting[0].song_id);
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

async function authorizer(username, password){
    let adminsDB = await client.json.get('admins', {path: `$.${username}`});
    if(adminsDB.length != 0 && adminsDB[0].password == password){
        return "admin";
    }

    let usersDB = await client.json.get('users', {path: `$.${username}`});
    if(usersDB.length != 0 && usersDB[0].password == password){
        return "user";
    } 
    return "none"
}