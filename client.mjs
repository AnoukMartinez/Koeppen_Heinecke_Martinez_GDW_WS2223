import fetch from 'node-fetch'
import * as readline from 'node:readline';
globalThis.fetch = fetch

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

function readNumber(question, limit){
    return new Promise(function(resolve, reject){
        rl.question(question, function(answer){
            if(answer <= limit && answer >= 0){
                resolve(answer);
            } else {
                console.log("This option does not exist. Please try again.")
                readNumber(question, limit);
            }
        })
    })
}

function readString(question){
    return new Promise(function(resolve, reject){
        rl.question(question, function(answer){
            resolve(answer);
        })
    })
}

function isBadRequest(response){
    if(response.status <= 400 && response.status > 500) {
        console.log("Something went wrong... Try again!")
        return true;
    } else if(response.status <= 500 && response.status > 600) {
        console.log("Something went wrong... But it's on our side!\n");
        return true;
    } else if(response.status == 200 || response.status == 201){
        return false;
    }
    return false;
}

async function home(){
    console.log("\nWelcome to the Partymaker9000!\n");
    let next = await readNumber(`Please press...
    (0) Create a new party
    (1) View existing parties\n`, 1);
    if(next == 0){
        makeParty();
    } else getEvents();
}

async function makeParty(name){
    const partyName = await readString("Please choose a name for your party.\n");

    fetch('http://localhost:3000/create/' + partyName, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if(!isBadRequest(response)){
            console.log("Your party has been created successfully!");
        }
    }).then(response => {
        var next = readNumber('Press...\n   (0) Create another event\n   (1) View Events\n', 1).then(next =>{
            if(next == 0){
                makeParty();
            } else getEvents();
        })
    })
}

async function searchTrack(eventId, query){
    fetch('http://localhost:3000/search/' + query, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => response.json())
    .then(json => {
        console.log("\nYour song name has returned these search results...\n");

        let allResults = [];
        for(let i = 0; i < json.length; i++){
            allResults.push(json[i]);
            console.log(`${i+1}. ${json[i].name} by ${json[i].artist}`);
        }

        var userPick = readNumber(`\nWhich one is your pick?\n`, LIMIT).then(userPick => {
            console.log();
            addTrack(eventId, allResults[userPick - 1].artist, allResults[userPick - 1].name);
        })
    })
};

function getEvents(){
    fetch('http://localhost:3000/events', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => response.json())
    .then(json => {
        if(isBadRequest(json)){
            return;
        }
        
        if(json.length == undefined){
            console.log("\nIt looks like there haven't been any events yet.\nBe the first one to create one today!");
            var createNext = readNumber("Press...\n   (0) Go Back\n   (1) Create a new Event\n", 1);
            if(createNext == 0){
                home();
            } else {
                makeParty();
            }
        } else {
            let i = 0;
            console.log("\nViewing All Parties...");
            for(i = 0; i < json.length; i++){
                var ongoing = json[i].isActive;
                if(ongoing){
                    ongoing = "Party Is On!";
                } else {
                    ongoing = "Party Is Over...";
                }
                console.log(`${i+1}. ${json[i].name} (${ongoing})`);
            }
            
            console.log('\nPress...\n   (0) Go back\n\nTo view more details on an event, ');
            var next = readNumber("please insert its number.\n", i).then(next => {
                if(next == 0){
                    home();
                } else getEvent(next - 1);
            })
        }
    })
};

function getEvent(eventId){
    fetch('http://localhost:3000/events/' + eventId, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => response.json())
    .then(json => {
        console.log(`\nYou are viewing information on event ${eventId + 1}...\n`);
    var next = readString("Press...\n   (0) Go Back to Events\n   (1) See Voting\n   (2) See Tracklist\n", 2)
    .then(next => {
        if(next == 0){
            getEvents();
        } else if(next == 1){
            console.log(`\nVoting in Event ${eventId + 1}:`);
            try{ // TODO Funktioniert noch nicht, daher catch statement
                for(let i = 0; i < 10; i++){ // 10 muss durch voting.length ausgetauscht werden
                    console.log(`Spot ${i + 1}: ${json.voting[i].name} by ${json.voting[i].artist} (Popularity ${json.voting[i].popularity})`);
                }
            } catch {

            } 
            var voting = readNumber("\n\n   (0) Go Back to Events\n   (1) Vote for an existing song\n   (2) Add a new song\n", 2)
            .then(voting => {
            if(voting == 0){
                getEvents();
            } else if(voting == 1){
                var songId = readNumber("Which song number do you want to vote for? Enter a number.\n", 2)
                .then(songId => voteTrack((songId - 1), eventId))
            } else if(voting == 2){
                var songName = readString("What song do you want to add? Enter a name.\n")
                .then(songName => searchTrack(eventId, songName))
            }
        })
        } else if(next == 2){
            console.log(`Tracklist of Event ${eventId + 1}`)
            for(let i = 0; i < json.length; i++){
                console.log(`${i + 1}. ${json.tracklist[i].name} by ${json.tracklist[i].artist}`);
            }
            var goBack = readNumber("   (0) Go Back\n", 0).then(goBack => getEvent(eventId));
        }
    })
    })
};

async function voteTrack(eventId, trackId){
    fetch('http://localhost:3000/events/' + eventId + '/vote/' + trackId, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => {
        console.log(response.status); // TODO Soll res.send drucken
        console.log("You are now being forwarded to the event page again!");
    }).then(getEvent(eventId));
};
    
function addTrack(eventId, artist, title){
    fetch('http://localhost:3000/events/' + eventId + '/add/' + artist + '/' + title, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if(!isBadRequest(response)){
            console.log("Your event has been added successfully!");
        }
        console.log("You are now being forwarded to the event page again.");
    }).then(getEvent(eventId));
};

home();