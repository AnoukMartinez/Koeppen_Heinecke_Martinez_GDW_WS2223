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
    constructor(artist, title, spotify_song_id){
        this.artist = artist,
        this.title = title,
        this.spotify_song_id = spotify_song_id
    }
}

class Song {
    constructor(artist, title, votes, spotify_song_id, spotify_artist_id, genre){
        this.artist = artist,
        this.title = title,
        this.votes = votes,
        this.spotify_song_id = spotify_song_id,
        this.spotify_artist_id = spotify_artist_id,
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

// CREATES NEW USER OR ADMIN (body requires: type, username, password)
app.post('/users', async(req, res) => {
    if(req.body.type == "admin"){
        let newAdmin = new Admin(req.body.admin, req.body.username, req.body.password);
        await client.json.set('admins', '.' + newAdmin.username, {"password":newAdmin.password});
        res.status(201).send("New Admin has been created!");
    } else {
        let newUser = new User(req.body.admin, req.body.username, req.body.password);
        await client.json.set('users', '.' + newUser.username, {"password":newUser.password});
        res.status(201).send("New User has been created!")
    }
})

// VIEWS ALL EXISTING USERS (body requires: username, password)
app.get('/users', async (req, res) => {
    let admins = await client.json.get('admins');
    let users = await client.json.get('users');
    let allUsers = []
    for (const key in admins) {
        allUsers.push(new User("admin", key));
    }
    for (const key in users) {
        allUsers.push(new User("user", key));
    }
    res.json(allUsers);
    res.status(200);
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
                                                    element.votes.length, element.genre));
            i++;
        })
        

        event.voting = displayVoting.sort(({popularity : a}, {popularity : b}) => b - a);
        return res.send(event)
    } catch {
        return res.status(404).send("Event Does Not Exist...");
    } 
});

// SEARCH A SONG (query: localhost:xxxx/songs/irgendeinname)
app.get('/songs/title=:title&type=:type&limit=:limit', async (req, res) => {
    const track = req.params.title;
    const type = req.params.type;
    const limit = req.params.limit;
    const result = await searchTrack(track, type, limit);
    res.json(result);
});

// VOTE FOR EXISTING SONG (body requires: username, password)
app.patch('/events/:eventIndex/songs/:songIndex/vote', async (req, res) => {
    const eventIndex = req.params.eventIndex;
    const songIndex = req.params.songIndex;
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
        if(currEvent.voting[songIndex].votes.includes(req.body.username)){
            return res.status(403).send("A vote by this profile has already been registered.")
        }

        await client.json.ARRAPPEND('events', `$[${eventIndex}].voting[${songIndex}].votes`, req.body.username);
        res.status(201).send(`Successfully voted for ${currEvent.voting[songIndex].title} by ${currEvent.voting[songIndex].artist}!`);
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.")
    }
});

// DELETES A USER VOTE FROM A SPECIFIED SONG (body requires: username, password)
app.delete('/events/:eventIndex/songs/:songIndex/vote', async (req, res) => {
    const eventIndex = req.params.eventIndex;
    const songIndex = req.params.songIndex;
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
        let exists = currEvent.voting[songIndex].votes.findIndex(user_id => user_id == req.body.username)
        if(exists != -1){
            await client.json.arrPop('events', `$[${eventIndex}].voting[${songIndex}].votes`, exists);
            return res.status(201).send(`The vote by ${req.body.username} on ${currEvent.voting[songIndex].title} by ${currEvent.voting[songIndex].artist} has been successfully removed.`);
        }
        return res.status(403).send("No vote by this profile has been registered.");
    } else {
        res.status(405).send("Your credentials don't match those of an existing user.");
    }
});

// ADD NEW SONG (body requries: username, password, eventIndex, spotify_song_id)
app.post('/events/:eventIndex/songs', async (req, res) => {
    let auth = await authorizer(req.body.username, req.body.password);

    if(auth != "none"){
        let eventIndex = req.params.eventIndex;
        let currEvent;
        try {
            currEvent = await client.json.get('events', {path: [`.[${eventIndex}]`]});
        } catch {
            return res.status(404).send("Event Does Not Exist...");
        }

        if(!currEvent.isActive){
            return res.status(403).send("Event Is Not Active Anymore...");
        }
        
        let spotify_song_id = req.body.spotify_song_id;
        let newSong = await getSongDetail(spotify_song_id);

        const exists = currEvent.voting.findIndex(song => song.spotify_song_id == newSong.spotify_song_id);
        if(exists != -1){
            if(currEvent.voting[exists].votes.includes(req.body.username)){
                return res.status(403).send("There is a vote already registered for an existing song like this.")
            }
            await client.json.ARRAPPEND('events', `$[${eventIndex}].voting[${exists}].votes`, req.body.username);
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
app.delete('/events/:eventIndex/songs/:songIndex', async (req, res) => {
    let eventIndex = req.params.eventIndex;
    let songIndex = req.params.songIndex;
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
app.patch('/events/:eventIndex', async (req, res) => {
    let eventIndex = req.params.eventIndex;
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
app.get('/events/:eventIndex/songs/recommendations/limit=:limit', async (req, res) => {
    let eventIndex = req.params.eventIndex;
    let limit = req.params.limit;
    let currEvent;
    try {
        currEvent = await client.json.get('events', {path: [`.[${eventIndex}]`]});
    } catch {
        return res.status(404).send("This event does not exist.");
    }
    if(currEvent.voting.length == 0){
        return res.status(404).send("There are no entries yet to base recommendations on.")
    }

    const result = await getRecommendations(currEvent.voting, limit);
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

async function searchTrack(track, type, limit){
    var token = await getToken();
    return new Promise(function(resolve, reject) {
        fetch(("https://api.spotify.com/v1/search?q=" + track + "&type=" + type + "&limit=" + limit), { 
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
                for(let i = 0; i < limit; i++){
                    // console.log(json.tracks.items[i]);
                    allResults.push(new DisplaySong(json.tracks.items[i].artists[0].name, 
                                                    json.tracks.items[i].name, 
                                                    json.tracks.items[i].id))
                };
            resolve(allResults);
    })
});
};

async function getTrackDetail(spotify_song_id){
    var token = await getToken();
    return new Promise(function(resolve, reject) {
        fetch(('https://api.spotify.com/v1/tracks/' + spotify_song_id), {
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
            let votes = [];
            let spotify_song_id = json.id;
            let spotify_artist_id = json.artists[0].id;
            let newSong = new Song(artist, title, votes, spotify_song_id, spotify_artist_id);
            resolve(newSong);
        })
    })
}

async function getSongDetail(spotify_song_id){
    let newSong = await getTrackDetail(spotify_song_id);
    let genre = await getArtistGenre(newSong.spotify_artist_id);
    let finalSong = new Song(newSong.artist, newSong.title, newSong.votes, newSong.spotify_song_id,
                                newSong.spotify_artist_id, genre);
    return finalSong;
}

async function getArtistGenre(spotify_artist_id){
    var token = await getToken();
    return new Promise(function(resolve, reject) {
        fetch(('https://api.spotify.com/v1/artists/' + spotify_artist_id), {
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

async function getRecommendations(voting, limit){
    var token = await getToken();

    let seed_artists = [];
    let seed_genres = [];
    let seed_tracks = [];

    // 5 Seeds Total (Interchangeable)
    for(let i=0;i < voting.length && i < 2;i++){
        seed_genres.push(voting[i].genre[0]);
        seed_artists.push(voting[i].spotify_artist_id);
    }

    seed_tracks.push(voting[0].spotify_song_id);
    seed_artists = seed_artists.join(",");
    seed_genres = seed_genres.join(",");   

    return new Promise(function(resolve, reject) {
        fetch(('https://api.spotify.com/v1/recommendations?seed_artists=' + seed_artists + '&seed_genres=' + seed_genres + '&seed_tracks=' + seed_tracks + '&limit=' + limit), {
            method: "GET",
            headers: {
                "Authorization" : "Bearer " + token,
                "Content-Type" : "application/json"
            }
        }).then(response => response.json())
        .then(json => {
            let allRecommendations = [];

            for(let i = 0; i < limit; i++){
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