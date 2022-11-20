import fetch from 'node-fetch'
globalThis.fetch = fetch
import * as readline from 'node:readline';
import { client_id } from './secrets.mjs'
import { client_secret } from './secrets.mjs'
/* Wenn dieses Kommentar immer noch hier ist, bedeutet das wahrscheinlich
    dass ich vergessen habe, die secret.mjs Datei zu teilen. 
    Sprecht mich einfach darauf an und erinnert mich daran, diese zu aktualisieren. */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var token = ""; // Initialisierung des Access_Tokens (Wird aktualisiert)
var timeStamp = 0; // TimeStamp um den Access_Token manuell zu erneuern
var LIMIT = 10; // Limit für die Anzahl der Ergebnisse, die per Suche ausgegeben werden

class Song {
    constructor(name, artist, popularity){
        this.name = name,
        this.artist = artist,
        this.popularity = popularity
    }
};

const voting = [];
var testingDoubles = new Song ("Swans", "Blind", 1);
voting.push(testingDoubles);

/* Fordert von Spotify mit einem POST request mit den client credentials
    (Zusammengesetzt aus client_id und client_secret, und eigentlich in Basis 64 codiert,
    aber aus irgendeinem Grund funktioniert das auch so also egal) ein JSON an, welches
    den access_token, token_type und expires_in (in ms) enthält */
function fetchToken(){
    let promise = new Promise(function (resolve, reject) {
    fetch('https://accounts.spotify.com/api/token', {
        method: "POST",
        body: 'grant_type=client_credentials&client_id=' + client_id + '&client_secret=' + client_secret,
            // 'grant_type': 'client_credentials', 
        headers: {
            // 'Authorization': 'Basic ' + token, // Dachte die müsste dabei sein aber anscheinend nicht
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then((response) => {
        if(response.ok){
            timeStamp = Date.now()
            // console.log("All good!")
            resolve(response.json());

            // response => {return Promise.resolve(response.json())};
            // json => console.log(json);
        } else {
            reject("Looks like something went wrong.");
        }
    })
    })
    return promise;
};

/* Ersetzt den Initialwert von token mit dem access_token aus dem zurückgegebenen JSON aus
    der Funktion fetchtoken() */
function getToken(){
    let promise = new Promise(function(resolve, reject) {
        // console.log(Date.now() + " " + timeStamp)
        if((Date.now() - timeStamp) > 600000){
            fetchToken()
            .then((result) => {
                token = result.access_token;
                // console.log("In then " + result.access_token)
                // setTimeout(function() {resolve(token)}, 200) // Ich weiß nicht mehr warum das hier ist
                resolve(token);
            })
            .catch((error) => console.log(error))
        } else {
            resolve(token);
        }
    })
    return promise;
};

/* Lässt den User über die Konsole einen Track anfragen */
async function askTrack(){
    return new Promise(function(resolve, reject){
         rl.question("Suche nach einem Song... \n", function(answer) {
            resolve(answer);
         })
    })
};

/* Sucht mit der Eingabe aus askTrack() nach einem Song mithilfe von fetchTrack().
Funktion des setTimeout: Spotify benötigt etwa 200ms (könnte auch mehr sein?), um 
den access_token zu generieren und zurück an den Client zu senden.*/
async function searchTrack(){
    const track = await askTrack();
    getToken().then((token) => 
        // console.log(token),
        setTimeout(function() {fetchTrack(track, token)}, 500) // 200ms ungefähr (könnte das Programm zum Absturz bringen)
    )
    setTimeout(function() { console.log(voting) }, 1000); // Ok hier muss ein Timer hin anscheinend
    voting.sort((a,b) => b.popularity - a.popularity);
};

function askResult() {
    return new Promise((resolve, reject) => {
        const loop = function () {
            rl.question("Bitte wählen Sie den richtigen Song. \n", function(answer) {
                if(answer <= LIMIT && answer > 0){
                    resolve(answer);
                }
                loop();
                // reject(answer);
            })
        }
        loop();
    })
};

function voteSong(song){
    var songIndex = voting.findIndex(exists => exists.name === song.name && exists.artist == song.artist);
    if(songIndex >= 0){ // Wenn song bereits existiert, vorhandene popularity um einen erhöhen
        voting[songIndex].popularity += 1;
    } else {
        voting.push(song); // sonst, neu zur Liste hinzufügen
    };
}

/* Sendet einen GET request an spotify, und erhält ein JSON mit verschiedenen Informationen
über die Suchergebnisse (etwa: Erscheinungsdatum, Künstler, Internationale Verfügbarkeit) 
zurück. Aus diesem werden die ersten [LIMIT]. Namen, Künstler und Spotify URLs ausgegeben. */
function fetchTrack(track, token){
    fetch(("https://api.spotify.com/v1/search?q=" + track + "&type=track&limit=" + LIMIT), { 
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            }
        })
        .then(response => response.json())  // convert to json
        .then(json => {
            var temp = []; // Speichert temporär alle 10 oder so Ergebnisse ab

            for(let i = 0; i < LIMIT; i++){
                // console.log(json.tracks.items[i]) // Druckt gesamte Rückgabe von spotify, aber in schön
                console.log((i+1) + ". " + json.tracks.items[i].name + " by " + json.tracks.items[i].artists[0].name);
                temp.push(new Song(json.tracks.items[i].artists[0].name, json.tracks.items[i].name, 1));
                
                // console.log('Link: ' + json.tracks.items[i].external_urls.toString());
            };

            var test = 0
            while(test = 0){
                test = askResult();
            }
            voteSong(temp[test - 1])
            /* askResult().then(answer => {
                voteSong(temp[answer - 1])
            }) */

            console.log("Successfully Voted!")
            // let song = new Song(json.tracks.items[i].artists[0].name, json.tracks.items[i].name, 1)
                
        }) 
        .catch(err => console.log('Request Failed', err)); // catch errors
};

// setInterval(function() {searchTrack("Tool")}, 1000) // Zum Testen
// setInterval(function() {searchTrack()}, 1000) // Zum Testen
// searchTrack("Tool")
// This throws the 401 error

searchTrack(); // Sucht einmalig nach Song
searchTrack();
searchTrack();