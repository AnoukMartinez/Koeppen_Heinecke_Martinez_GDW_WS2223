import fetch from 'node-fetch'
globalThis.fetch = fetch
import * as readline from 'node:readline';
import { client_id } from './secrets.mjs'
import { client_secret } from './secrets.mjs'
// Wenn dieses Kommentar immer noch hier ist, bedeutet das wahrscheinlich
// dass ich vergessen habe, die secret.mjs Datei zu teilen. 
// Sprecht mich einfach darauf an und erinnert mich daran, diese zu aktualisieren.

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var token = "Test" 
var timeStamp = 0

function fetchToken(){
    let promise = new Promise(function (resolve, reject) {
    fetch('https://accounts.spotify.com/api/token', {
        method: "POST",
        body: 'grant_type=client_credentials&client_id=' + client_id + '&client_secret=' + client_secret,
            // 'grant_type': 'client_credentials',
        headers: {
            // 'Authorization': 'Basic ' + token,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then((response) => {
        if(response.ok){
            timeStamp = Date.now()
            console.log("All good!")
            resolve(response.json());

            // response => {return Promise.resolve(response.json())};
            // json => console.log(json);
        } else {
            reject("Looks like somehing went wrong.")
        }
    })
    })
    return promise

}

function getToken(){
    let promise = new Promise(function(resolve, reject) {
        console.log(Date.now() + " " + timeStamp)
        if((Date.now() - timeStamp) > 600000){
            fetchToken()
            .then((result) => {
                token = result.access_token
                console.log("In then " + result.access_token)
                // setTimeout(function() {resolve(token)}, 200)
                resolve(token)
            })
            .catch((error) => console.log(error))
        } else {
            resolve(token)
        }
    })
    return promise
}

async function askTrack(){
    return new Promise(function(resolve, reject){
         rl.question("Suche nach einem Song... \n", function(answer) {
            resolve(answer)
         })
    })
}

// .then(response => token = response.body.access_token)
async function searchTrack(){
    const track = await askTrack();
    getToken().then((token) => 
        console.log(token),
        setTimeout(function() {fetchTrack(track, token)}, 200) // 200 subjective and may or may not break things
    )
}

function fetchTrack(track, token){
    fetch(("https://api.spotify.com/v1/search?q=" + track + "&type=track"), {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            }
        })
        .then(response => response.json())  // convert to json
        .then(json => console.log(json)) // print results
        .catch(err => console.log('Request Failed', err)); // catch errors
}

setInterval(function() {searchTrack("Tool")}, 1000)
// searchTrack("Tool")
// This throws the 401 error