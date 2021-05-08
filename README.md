# Evolving TSP Routes
Machi Iwata

Peter Dolan / Nic McPhee

5/8/21
## Contents
[Overview/Purpose](#overviewpurpose)

[Overview/Solution](#overviewsolution)

[User Documentation](#userdocumentation)

[Technical Details](#technicaldetails)
 - [API](#api)
 - [Lambdas](#lambdas)
 - [IAM Roles](#iamroles)
 - [Table Structures](#tablestructures)
 - [Leaflet](#leaflet)

[Code Apendice](#codeapendice)
- [Lambda](#lambda)
	- [`getBestRoutes`](#getbestroutes)
	- [`generateRandomRoutes`](#generaterandomroutes)
	- [`getRoutesById`](#getroutebyid)
	- [`getCityData`](#getcitydata)
	- [`mutateRoutes`](#mutateroutes)
- [JavaScript](#javascript)
- [HTML](#html)
	
## Overview/Purpose
This application was created as the final project of a class called cloud computing. We made a web map app using the basics and skills we learned through the half-semester. DynamoDB, Lambda, IAM, API Gateway from Amazon Web Services (AWS) are used in the project. This application computes and finds the shortest route of given cities in Minnesota state, and displays the best route on the map. The base idea/concept of this application is same as Traveling Salesman Problem (TSP) and which starts from a city and finds the route that visits each city exactly once and returns to the origin city. With AWS, building serverless computing service would be possible and we don't need to worry about storage, security, servers, databases, and more. 

## Overview/Solution
The application is structured with JavaScript (evotsp.js) and HTML. Through API, Lambda functions are connected to the app and return the data after the request. The best route gets returned every generation and updated for each generation. Then the best route becomes the "parent" route and gets passed to create children routes in mutateRoutes lambda. With the children route, it will find a new best route. That will be repeated until the last generation and keep looking for the best route, and at the end of the process, it will display the best route on the map, and make a list of "best" such as routeId, length of the best path, path (for example, [city1, city3, city 9, ... city1]), and threshold. Threshold is used as limiting the writes number for the dynamoDB.

## User Documentation
The appearance of the application looks like this. It is very simple and easy to use. 
There are already numbers assigned in some fields; "population size" is 20 and "Number of parents to keep" and 'the number of generations to make' are 100 as default. 

![image1](https://github.com/iwata008/EvoTSP_Final_Project/blob/main/screenshot/screenshot-map.png)

By clicking "run evolution" the application creates the Run Id and starts looking for the best route. Until the last generation (which is 20 as default in this case) it keeps looking for the best route. It creates Run Id only once. This is how it looks when it's done finding the best route. 

![image2](https://github.com/iwata008/EvoTSP_Final_Project/blob/main/screenshot/img2.png)
![image3](https://github.com/iwata008/EvoTSP_Final_Project/blob/main/screenshot/img3.png)

## Technical Details

The application uses the API Gateway from AWS, and there are 5 resources for this application.

- The `/best` endpoint uses the GET method, and it calls the getBestRoutes lambda function. And adding to /best, the path has runId, generation, and numToReturn which is the number of how many should be returned. This returns the best routes of the number you wanted to return. 

- The `/Routes` endpoint uses the POST method, and it calls the generateRandomRoutes lambda function. It takes runId and generation to create random routes. And after the routes got created, it puts them into the database.

- The `/Routes/{routeId}` endpoint uses the GET method and it calls the getRouteById lambda function. In order for this endpoint to work, the path has to have {routeId}. It takes routeId and returns routeId, runGen (runId and generation), len (length), and route of the passed routeId. 

- The `/city-data` endpoint uses the GET method and it calls the getCityData lambda function. This one is very simple and does not take any argument. This gets the city data of the Minnesota region from the database.

- The `mutateroute` endpoint uses the POST method and it calls the mutateRoutes lambda function. This takes numChildren (number of children), routeId, and lengthStoreThreshold.

## Code Apendice

### Lambda
## `getBestRoutes()`
```js
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
     const queryStringParameters = event.queryStringParameters;
    const runId = queryStringParameters.runId;
    const generation = queryStringParameters.generation;
    const numToReturn = queryStringParameters.numToReturn;

    getBestRoutes(runId, generation, numToReturn)
        .then(dbResults => {


            console.log("//////////I'm HERE/////////////");
            console.log(JSON.stringify(dbResults));
            const bestRoutes = dbResults.Items;
            console.log(bestRoutes);

            callback(null, {
                statusCode: 201,
                body: JSON.stringify(bestRoutes),
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            });
        })
        .catch(err => {
            console.log(`Problem getting best runs for generation ${generation} of ${runId}.`);
            console.error(err);
            errorResponse(err.message, context.awsRequestId, callback);
        });
}

function getBestRoutes(runId, generation, numToReturn) {
    const runGen = runId + "#" + generation;
    console.log(runGen);
    console.log(numToReturn);
    return ddb.query({
        TableName: 'Routes',
        IndexName: 'runGen-len-index',
        ProjectionExpression: "routeId, len, runGen, route",
        KeyConditionExpression: "runGen = :runGen",
        ExpressionAttributeValues: {
                ":runGen": runGen
            },
        Limit: numToReturn
    }).promise();
}

function errorResponse(errorMessage, awsRequestId, callback) {
  callback(null, {
    statusCode: 500,
    body: JSON.stringify({
      Error: errorMessage,
      Reference: awsRequestId,
    }),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

## `generateRandomRoutes()`
```js
// Got help from Utkarsh and Nicc

const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const randomBytes = require('crypto').randomBytes;

exports.handler = (event, context, callback) => {
    const requestBody = JSON.parse(event.body);
    const runId = requestBody.runId;
    const generation = requestBody.generation;


    // Get distance information from distance_data
    getDistanceInfo()
    .then(dbResults => {
        const { distances, cities } = dbResults.Item;
        //console.log({distances, cities});
        const routes = cities.map(cities => cities.index);
        console.log(routes);
        const routeId = toUrlString(randomBytes(16));

        shuffle(routes);

        const length = computeDistance(routes, distances);

        const runGen = runId + '#' + generation;

        recordRoutes(runGen, routeId, routes, length)
            .then((result) => {
                console.log(JSON.stringify(result));
                console.log(runGen, routeId, routes, length);
                callback(null, {
                    statusCode: 201,
                    body: JSON.stringify({ routeId: routeId, len: length }),
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    }
                });

            })
            .catch(err => {
                console.log(`Problem recording routes`);
                console.error(err);
                errorResponse(err.message, context.awsRequestId, callback);
            });

    }).catch(err => {
        console.log(`Problem getting distance info`);
        console.error(err);
        errorResponse(err.message, context.awsRequestId, callback);
    });



};




// Get the city and distance info from the DynamoDB table containing that data.
function getDistanceInfo() {
    return ddb.get({
        TableName: 'distance_data',
        Key: { region: 'Minnesota' }

    }).promise();
}


// ex) N = 7
// i = 6 -> random index from 0 to 6
// array = [0, 1, 2, 3, 4, 5, 6]


function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        // random index from 0 to i
        let j = Math.floor(Math.random() * (i + 1));


        // swap elements array[i] and array[j]
        // We use "destructuring assignment" syntax to achieve that,
        // but the same could be written as:
        // let t = array[i]; array[i] = array[j]; array[j] = t
        [array[i], array[j]] = [array[j], array[i]];


    }
}
/*
function computeDistance(routes, distance) {

    let routeDistance = 0;

    for (let i = 0; i < routes.length - 1; i++) {
        const currentCity = routes[i];
        const nextCity = routes[i + 1];
        routeDistance = routeDistance + distance[currentCity][nextCity];
    }
    routeDistance = routeDistance + distance[routes.length - 1][0]
    return routeDistance;
} */

function computeDistance(route, distances) {

    let routeDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
        routeDistance = routeDistance + distances[route[i]][route[i + 1]];

    }

    routeDistance = routeDistance + distances[route[0]][route[route.length - 1]];

    return routeDistance;
}





// Record routes and put these information to database
function recordRoutes(runGen, routeId, route, length) {

    return ddb.put({
        TableName: 'Routes',
        Item: {
            runGen: runGen,
            routeId: routeId,
            route: route,
            len: length
        },
        ReturnValues: "ALL_OLD"
    }).promise();
}


function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function errorResponse(errorMessage, awsRequestId, callback) {
    callback(null, {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: awsRequestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}
```

## `getRouteById()`
```js
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
    const pathParameters = event.pathParameters;
    const routeId1 = pathParameters.routeId;

    //console.log(routeId1);

    getRouteById(routeId1)
        .then(dbResults => {

            console.log("/////////////// HERE ///////////");
            console.log(dbResults.Item);
            callback(null, {
                statusCode: 201,
                body: JSON.stringify(dbResults.Item),
                headers: {
                    'Access-Control-Allow-Origin': '*'

                }
            });
        })
         .catch(err => {
            console.log(`Problem with ${routeId1}`);
            console.error(err);
            errorResponse(err.message, context.awsRequestId, callback);
        });

}
function getRouteById (routeId1) {
    return ddb.get({
        TableName:'Routes',
        Key:{"routeId":routeId1},
    }).promise();
}

function errorResponse(errorMessage, awsRequestId, callback) {
    callback(null, {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: awsRequestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}
```
## `getCiyData()`
```js
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
    // const pathParameterString = event.pathParameterString;
    // const region = pathParameterString.region;

     getCities()
        .then(dbResults => {
            const cities = dbResults.Item.cities;
            console.log(cities);
            callback(null, {
                statusCode: 201,
                body: JSON.stringify(cities),
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            });
        })
         .catch(err => {
            console.log(`Problem with getCities`);
            console.error(err);
            errorResponse(err.message, context.awsRequestId, callback);
        });
}

function getCities() {
    return ddb.get({
        TableName: 'distance_data',
        Key: { region: 'Minnesota' },
        ProjectionExpression : "cities"
    }).promise();

}

// parsing error: shorthand prioerty assignments are valid only in destructuring patterns

function errorResponse(errorMessage, awsRequestId, callback) {
    callback(null, {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: awsRequestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}
```

## `mutateRoutes()`
```js 
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const randomBytes = require('crypto').randomBytes;

/*
 * Parts of this are already in working order, and
 * other parts (marked by "FILL THIS IN") need to be
 * done by you.
 *
 * For reference, here's a list of all the functions that
 * you need to complete:
 * - `getDistanceData()`. Finished
 * - `getRouteById()`     Finished
 * - `generateChildren()` Finished
 * - `addOneToGen()`.     Finished
 * - `recordChildren()`.  Finished
 * - `returnChildren`.    Finished
 * - `computeDistance`.   Finished
 */

// This will be called in response to a POST request.
// The routeId of the "parent" route will be
// provided in the body, along with the number
// of "children" (mutations) to make.
// Each child will be entered into the database,
// and we'll return an array of JSON objects
// that contain the "child" IDs and the length
// of those routes. To reduce computation on the
// client end, we'll also sort these by length,
// so the "shortest" route will be at the front
// of the return array.
//
// Since all we'll get is the routeId, we'll need
// to first get the full details of the route from
// the DB. This will include the generation, and
// we'll need to add one to that to create the
// generation of all the children.
exports.handler = (event, context, callback) => {
    const requestBody = JSON.parse(event.body);
    const routeId = requestBody.routeId;
    const numChildren = requestBody.numChildren;
    let lengthStoreThreshold = requestBody.lengthStoreThreshold;
    if (lengthStoreThreshold == null) {
        lengthStoreThreshold = Infinity;
    }


    // Batch writes in DynamoDB are restricted to at most 25 writes.
    // Because of that, I'm limiting this Lambda to only only handle
    // at most 25 mutations so that I can write them all to the DB
    // in a single batch write.
    //
    // If that irks you, you could create a function that creates
    // and stores a batch of at most 25, and then call it multiple
    // times to create the requested number of children.
    if (numChildren > 25) {
        errorResponse("You can't generate more than 25 mutations at a time", context.awsRequestId, callback);
        return;
    }

    // Promise.all makes these two requests in parallel, and only returns
    // it's promise when both of them are complete. That is then sent
    // into a `.then()` chain that passes the results of each previous
    // step as the argument to the next step.
    Promise.all([getDistanceData(), getRouteById(routeId)])
        .then(([distanceData, parentRoute]) => generateChildren(distanceData.Item, parentRoute.Item, numChildren))
        .then(children => recordChildren(children, lengthStoreThreshold))
        .then(children => returnChildren(callback, children))
        .catch(err => {
            console.log("Problem mutating given parent route");
            console.error(err);
            errorResponse(err.message, context.awsRequestId, callback);
        });
};

// Get the city-distance object for the region 'Minnesota'.
function getDistanceData() {
    return ddb.get({
        TableName: 'distance_data',
        Key: { region: 'Minnesota' }
    }).promise();
}

// Get the full info for the route with the given ID.
function getRouteById(routeId) {
    return ddb.get({
        TableName: 'Routes',
        Key: { "routeId": routeId },
    }).promise();
}

// Generate an array of new routes, each of which is a mutation
// of the given `parentRoute`. You essentially need to call
// `generateChild` repeatedly (`numChildren` times) and return
// the array of the resulting children. `generateChild` does
// most of the heavy lifting here, and this function should
// be quite short.
function generateChildren(distanceData, parentRoute, numChildren) {
    // FILL THIS IN
     var newRoutes = new Array();

   for (let i=0; i<numChildren; i++){ //creating a child route based off of the parent route and putting it into spot i of the array
        newRoutes[i] = generateChild(distanceData, parentRoute);
    }
    return newRoutes;

    // You could just use a for-loop for this, or see
    // https://stackoverflow.com/a/42306160 for a nice description of
    // how to use of Array()/fill/map to generate the desired number of
    // children.
}

// This is complete and you shouldn't need to change it. You
// will need to implement `computeDistance()` and `addOneToGen()`
// to get it to work, though.
function generateChild(distanceData, parentRoute) {

    // oldPath = [1,5,10,2,4,8,7,6,9,3,0]

    const oldPath = parentRoute.route;
    const numCities = oldPath.length;
    // These are a pair of random indices into the path s.t.
    // 0<=i<j<=N and j-i>2. The second condition ensures that the
    // length of the "middle section" has length at least 2, so that
    // reversing it actually changes the route.
    const [i, j] = genSwapPoints(numCities);
    // The new "mutated" path is the old path with the "middle section"
    // (`slice(i, j)`) reversed. This implements a very simple TSP mutation
    // technique known as 2-opt (https://en.wikipedia.org/wiki/2-opt).

     // i = 5
    // slice(0, i) =  [1,5,10,2,4]
    // slice(i, j) =  [8,7,6]

    //              [1,5,10,2,4].concat([6,7,8], 9,3,0)
    // newPath = [1,5,10,2,4,6,7,8,9,3,0]

    const newPath = oldPath.slice(0, i).concat(oldPath.slice(i, j).reverse(),oldPath.slice(j));
    const len = computeDistance(distanceData.distances, newPath);
    const child = {
        routeId: newId(),
        runGen: addOneToGen(parentRoute.runGen),
        route: newPath,
        len: len,
    };
    return child;
}

// Generate a pair of random indices into the path s.t.
// 0<=i<j<=N and j-i>2. The second condition ensures that the
// length of the "middle section" has length at least 2, so that
// reversing it actually changes the route.
function genSwapPoints(numCities) {
    let i = 0;
    let j = 0;
    while (j - i < 2) {
        i = Math.floor(Math.random() * numCities);
        j = Math.floor(Math.random() * (numCities + 1));
    }
    return [i, j];
}

// Take a runId-generation string (`oldRunGen`) and
// return a new runId-generation string
// that has the generation component incremented by
// one. If, for example, we are given 'XYZ#17', we
// should return 'XYZ#18'.
function addOneToGen(oldRunGen) {
    // FILL THIS IN
    // oldRunGen = XYZ#17
    // Should return XYZ#18
    // It takes oldRunGen which is structured with runId and generation
    // so only focus on generation then add 1


const strGeneration = oldRunGen;


	// Find where the '#' is
   const atSharp = oldRunGen.indexOf("#");
	// Shour return '3' in this case

	// Get only the part before '#'
    const parsedRunId = oldRunGen.substring(0, atSharp);

	// Get the rest of them (number/generation) after '#'
	const len = oldRunGen.length
    const parsedGeneration = oldRunGen.substring(atSharp + 1, len);

	console.log(parsedGeneration);

    const numberedGeneration = parseInt(parsedGeneration);
	console.log(numberedGeneration);
    const addedOneGen = numberedGeneration + 1;

    const newRunGen = parsedRunId + '#' + addedOneGen;
    return newRunGen;
}

// Write all the children whose length
// is less than `lengthStoreThreshold` to the database. We only
// write new routes that are shorter than the threshold as a
// way of reducing the write load on the database, which makes
// it (much) less likely that we'll have writes fail because we've
// exceeded our default (free) provisioning.
function recordChildren(children, lengthStoreThreshold) {
    // Get just the children whose length is less than the threshold.
    const childrenToWrite = children.filter(child => child.len < lengthStoreThreshold);

    // FILL IN THE REST OF THIS.
    // You'll need to generate a batch request object (described
    // in the write-up) and then call `ddb.batchWrite()` to write
    // those children to the database.
    var child = {
        RequestItems: {
            'Routes': []

        }
    };

    for (let i = 0; i < childrenToWrite.length; i++){

        child.RequestItems['Routes'].push({
            PutRequest: {
                Item: childrenToWrite[i]
            }
        });
    }

   ddb.batchWrite(child, function(err, data) {
        if (err) console.log(err);
        else console.log(data);
    }).promise();

    // After the `ddb.batchWrite()` has completed, make sure you
    // return the `childrenToWrite` array.
    // We only want to return _those_ children (i.e., those good
    // enough to be written to the DB) instead of returning all
    // the generated children.

    return childrenToWrite;
}







// Take the children that were good (short) enough to be written
// to the database.
//
//   * You should "simplify" each child, converting it to a new
//     JSON object that only contains the `routeId` and `len` fields.
//   * You should sort the simplified children by length, so the
//     shortest is at the front of the array.
//   * Use `callback` to "return" that array of children as the
//     the result of this Lambda call, with status code 201 and
//     the 'Access-Control-Allow-Origin' line.
function returnChildren(callback, children) {

    // Got it from https://medium.com/@asadise/sorting-a-json-array-according-one-property-in-javascript-18b1d22cd9e9

       let returnChild = children.sort(sortByLength("len"));

       let jsonChild = [];

       // Get an idea to remove JSON element in JavaScript
       // from https://stackoverflow.com/questions/5310304/remove-json-element/39753601
       // This deletes unnecessary elements (runGen and route) so only
       // routeId and len will be left

       for (let i = 0; i < children.length; i++) {
           jsonChild.push({
               routeId: returnChild[i].routeId,
               len: returnChild[i].len
           })

       }

        // call returnChild in body so it returns the array of children sorted by length
        callback(null, {
        statusCode: 201,
        body: JSON.stringify(jsonChild),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });


}

// Made a helper function for sorting an array of children
// https://medium.com/@asadise/sorting-a-json-array-according-one-property-in-javascript-18b1d22cd9e9
// Cookie gave me this link

function sortByLength(length){
   return function(a,b){
      if(a[length] > b[length])
         return 1;
      else if(a[length] < b[length])
         return -1;
      return 0;
   }
}

// Compute the length of the given route.
// This one is complete
function computeDistance(distances, route) {

    let routeDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
        routeDistance = routeDistance + distances[route[i]][route[i + 1]];

    }

    routeDistance = routeDistance + distances[route[0]][route[route.length - 1]];

    return routeDistance;
}

function newId() {
    return toUrlString(randomBytes(16));
}

function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function errorResponse(errorMessage, awsRequestId, callback) {
    callback(null, {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: awsRequestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}
```
### JavaScript 

evotsp.js
```js
(function evoTSPwrapper($) {
        const baseUrl =
            "https://bvahf7wcik.execute-api.us-east-1.amazonaws.com/prod";
        /*
         * This is organized into sections:
         * - Declaration of some global variables
         * - The `runEvolution` function and helpers
         * - The `runGeneration` function and helpers
         * - The Ajax calls
         * - The functions that update the HTML over time
         * - The functions that keep track of the best route
         * - The functions that initialize the map and plot the best route
         *
         * _Most_ of this is complete. You have to:
         *
         * - Fill in all the Ajax/HTTP calls
         * - Finish up some of the HTML update functions
         *
         * We gave you all the evolution stuff and the mapping
         * code, although what we gave you is pretty crude and
         * you should feel free to fancy it up.
         */
        // Will be populated by `populateCityData`
        var cityData;
        // No routes worse than this length will be stored in the
        // database or returned by methods that create new
        // routes.
        var lengthStoreThreshold = Infinity;
        // `best` stores what we know about the best route we've
        // seen so far. Here this is set to to "initial"
        // values, and then then these values are updated as better
        // routes are discovered.
        var best = {
                runID: "", // The ID of the best current path
                bestPath: [], // The array of indices of best current path
                len: Infinity, // The length of the best current path
                coords: [], // The coordinates of the best current path
                lRoute: [[], []], // best route as lat-long data
        };
        ////////////////////////////////////////////////////////////
        // BEGIN OF RUN EVOLUTION //////////////////////////////////

        ////////////////////////////////////////////////////////////
        // This runs the evolutionary process. This function and it's
        // helper functions are all complete and you shouldn't have to
        // change anything here. Some of these functions do call functions
        // "outside" this, some of which you'll need to write. In particular
        // you'll need to implement `randomRoute()` below in this section.
        function runEvolution() {
                // Generate a new runId and set the current generation to 0
                const runId = generateUID(16);
                const initialGeneration = 0;
                $("#runId-text-field").val(runId);
                $("#current-generation").text(initialGeneration);
                // `async.series` takes an array of (asynchronous) functions, and
                // calls them one at a time, waiting until the promise generated by
                // one has been resolved before starting the next one. This is similar
                // to a big chain of f().then().then()... calls, but (I think) cleaner.
                //
                // cb in this (and down below in runGeneration) is short for "callback".
                // Each of the functions in the series takes a callback as its last
                // (sometimes only) argument. That needs to be either passed in to a
                // nested async tool (like `asyn.timesSeries` below) or called after
                // the other work is done (like the `cb()` call in the last function).
                async.series([
                        initializePopulation, // create the initial population
                        runAllGenerations, // Run the specified number of generations
                        showAllDoneAlert, // Show an "All done" alert.
                ]);
                function initializePopulation(cb) {
                        const populationSize = parseInt($("#population-size-text-field").val());
                        console.log(
                            `Initializing pop for runId = ${runId} with pop size ${populationSize},generation = ${initialGeneration}`);
                      //  $("#new-route-list").text("");
                        async.times(
                            populationSize,
                            (counter, rr_cb) => randomRoute(runId, initialGeneration, rr_cb),
                            cb
                        );
                }
                function runAllGenerations(cb) {
                        // get number of generations

                        const numGenerations = parseInt($("#num-generations").val());
                        // `async.timesSeries` runs the given function the specified number
                        // of times. Unlike `async.times`, which does all the calls in
                        // "parallel", `async.timesSeries` makes sure that each call is
                        // done before the next call starts.
                        async.timesSeries(
                            numGenerations,
                            runGeneration,
                            cb
                        );
                }
                function showAllDoneAlert(cb) {
                        alert("All done! (but there could still be some GUI updates)");
                        cb();
                }
                // Generate a unique ID; lifted from https://stackoverflow.com/a/63363662
                function generateUID(length) {
                        return window
                            .btoa(
                                Array.from(window.crypto.getRandomValues(new Uint8Array(length * 2)))
                                    .map((b) => String.fromCharCode(b))
                                    .join("")
                            )
                            .replace(/[+/]/g, "")
                            .substring(0, length);
                }
        }
        function randomRoute(runId, generation, cb) {
                $.ajax({
                        method: 'POST',
                        url: baseUrl + '/Routes',
                        data: JSON.stringify({
                                runId: runId,
                                generation: generation
                        }),
                        contentType: 'application/json',

                        success: (displayRoute) => cb(null, displayRoute),
                        error: function ajaxError(jqXHR, textStatus, errorThrown) {
                                console.error(
                                    'Error generating random route: ',
                                    textStatus,
                                    ', Details: ',
                                    errorThrown);
                                console.error('Response: ', jqXHR.responseText);
                                alert('An error occurred when creating a random route:\n' + jqXHR.responseText);
                        }
                })
        }
        ////////////////////////////////////////////////////////////
        // END OF RUN EVOLUTION ////////////////////////////////////
        ////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////
        // BEGIN OF RUN GENERATION /////////////////////////////////
        ////////////////////////////////////////////////////////////
        // This runs a single generation, getting the best routes from the
        // specified generation, and using them to make a population of
        // new routes for the next generation via mutation. This is all
        // complete and you shouldn't need to change anything here. It
        // does, however, call things that you need to complete.
        function runGeneration(generation, cb) {
                const popSize = parseInt($("#population-size-text-field").val());
                console.log(`Running generation ${generation}`);
                // `async.waterfall` is sorta like `async.series`, except here the value(s)
                // returned by one function in the array is passed on as the argument(s)
                // to the _next_ function in the array. This essentially "pipes" the functions
                // together, taking the output of one and making it the input of the next.
                //
                // The callbacks (cb) are key to this communication. Each function needs to
                // call `cb(…)` as it's way of saying "I'm done, and here are the values to
                // pass on to the next function". If one function returns three values,
                // like `cb(null, x, y, z)`, then those three values will be the arguments
                // to the next function in the sequence.
                //
                // The convention with these callbacks is that the _first_ argument is an
                // error if there is one, and the remaining arguments are the return values
                // if the function was successful. So `cb(err)` would return the error `err`,
                // while `cb(null, "This", "and", "that", 47)` says there's no error
                // (the `null` in the first argument) and that there
                // are four values to return (three strings and a number).
                //
                // Not everything here has value to pass on or wants a value. Several are
                // just there to insert print statements for logging/debugging purposes.
                // If they don't have any values to pass on, they just call `cb()`.
                //
                // `async.constant` lets us insert one or more specific values into the

                // pipeline, which then become the input(s) to the next item in the
                // waterfall. Here we'll inserting the current generation number so it will
                // be the argument to the next function.
                async.waterfall(
                    [
                            wait5seconds,
                            updateGenerationHTMLcomponents,
                            async.constant(generation), // Insert generation into the pipeline
                            (gen, log_cb) => logValue("generation", gen, log_cb), // log generation
                            getBestRoutes, // These will be passed on as the parents in the next steps
                            (parents, log_cb) => logValue("parents", parents, log_cb), // log parents
                            displayBestRoutes, // display the parents on the web page
                            updateThresholdLimit, // update the threshold limit to reduce DB writes
                            generateChildren,
                            (children, log_cb) => logValue("children", children, log_cb),
                            displayChildren, // display children in the "Current generation" div
                            updateBestRoute
                    ],
                    cb
                );
                // Log the given value with the specified label. To work in the
                // waterfall, this has to pass the value on to the next function,
                // which we do with `log_cb(null, value)` call at the end.
                function logValue(label, value, log_cb) {
                        console.log(`In waterfall: ${label} = ${JSON.stringify(value)}`);
                        log_cb(null, value);
                }
                // Wait 5 seconds before moving on. This is really just a hack to
                // help make sure that the DynamoDB table has reached eventual
                // consistency.
                function wait5seconds(wait_cb) {
                        console.log(`Starting sleep at ${Date.now()}`);
                        setTimeout(function () {
                                console.log(`Done sleeping gen ${generation} at ${Date.now()}`);
                                wait_cb();
                                // Call wait_cb() after the message to "move on" through the
                        }, 5000);
                }
                // Reset a few of the page components that should "start over" at each
                // new generation.
                function updateGenerationHTMLcomponents(reset_cb) {
                        $("#new-route-list").text("");
                        $("#current-generation").text(generation + 1);
                        reset_cb();
                }
                // Given an array of "parent" routes, generate `numChildren` mutations
                // of each parent route. `numChildren` is computed so that the total
                // number of children will be (roughly) the same as the requested
                // population size. If, for example, the population size is 100 and
                // the number of parents is 20, then `numChildren` will be 5.
                function generateChildren (parents, genChildren_cb) {
                        const numChildren = Math.floor(popSize / parents.length);
                        // `async.each` runs the provided function once (in "parallel") for
                        // each of the values in the array of parents.
                        async.concat( // each(
                            parents,
                            (parent, makeChildren_cb) => {
                                    makeChildren(parent, numChildren, generation, makeChildren_cb);
                            },
                            genChildren_cb
                        );
                }
                // We keep track of the "best worst" route we've gotten back from the
                // database, and store its length in the "global" `lengthStoreThreshold`
                // declared up near the top. The idea is that if we've seen K routes at
                // least as good as this, we don't need to be writing _worse_ routes into
                // the database. This saves over half the DB writes, and doesn't seem to
                // hurt the performance of the EC search, at least for this simple problem.
                function updateThresholdLimit(bestRoutes, utl_cb) {
                        if (bestRoutes.length == 0) {
                                const errorMessage = 'We got no best routes back. We probably overwhelmed the write capacity for the database.';
                                alert(errorMessage);
                                throw new Error(errorMessage);
                        }
                        // We can just take the last route as the "worst" because the
                        // Lambda/DynamoDB combo gives us the routes in sorted order by
                        // length.
                        lengthStoreThreshold = bestRoutes[bestRoutes.length - 1].len;
                        $("#current-threshold").text(lengthStoreThreshold);
                        utl_cb(null, bestRoutes);
                }
        }
        ////////////////////////////////////////////////////////////
        // END OF RUN GENERATION ///////////////////////////////////
        ////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////
        // START OF AJAX CALLS /////////////////////////////////////
        ////////////////////////////////////////////////////////////
        // These are the various functions that will make Ajax HTTP
        // calls to your various Lambdas. Some of these are *very* similar
        // to things you've already done in the previous project.
        // This should get the best routes in the specified generation,
        // which will be used (elsewhere) as parents. You should be able
        // to use the (updated) Lambda from the previous exercise and call
        // it in essentially the same way as you did before.
        //
        // You'll need to use the value of the `num-parents` field to
        // indicate how many routes to return. You'll also need to use
        // the `runId-text-field` field to get the `runId`.
        //
        // MAKE SURE YOU USE
        //
        // (bestRoutes) => callback(null, bestRoutes),
        //
        // as the `success` callback function in your Ajax call. That will
        // ensure that the best routes that you get from the HTTP call will
        // be passed along in the `runGeneration` waterfall.
        function getBestRoutes(generation, callback) {
                // FILL THIS IN
                const runId = $('#runId-text-field').val();
                const numToReturn = $('#num-parents').val();
                // let generation = $('#num-generations').val();

                $.ajax({
                        method:'GET',
                        url: baseUrl + `/best?runId=${runId}&generation=${generation}&numToReturn=${numToReturn}`,
                        contentType: 'application/json',
                        success: (bestRoutes) => callback(null, bestRoutes),
                        error: function ajaxError(jqXHR, textStatus, errorThrown) {
                                console.error(
                                    'Error generating best routes: ',
                                    textStatus,
                                    ', Details: ',
                                    errorThrown);
                                console.error('Response: ', jqXHR.responseText);
                                alert('An error occurred when creating a random route:\n' + jqXHR.responseText);
                        }
                })




        }
        // Create the specified number of children by mutating the given
        // parent that many times. Each child should have their generation
        // set to ONE MORE THAN THE GIVEN GENERATION. This is crucial, or
        // every route will end up in the same generation.
        //
        // This will use one of the new Lambdas that you wrote for the final
        // project.
        //
        // MAKE SURE YOU USE
        //
        // children => cb(null, children)
        //
        // as the `success` callback function in your Ajax call to make sure
        // the children pass down through the `runGeneration` waterfall.
        function makeChildren(parent, numChildren, generation, cb) {
                // FILL THIS IN

                $.ajax({
                        method:'POST',
                        url: baseUrl + `/mutateroute`,
                        contentType: 'application/json',
                        data: JSON.stringify({ //body, not queryParameters
                                routeId: parent.routeId,
                                lengthStoreThreshold: lengthStoreThreshold,
                                numChildren: numChildren
                        }),
                        success: (children) => cb(null, children),
                        error: function ajaxError(jqXHR, textStatus, errorThrown) {
                                console.error(
                                    'Error making child routes: ',
                                    textStatus,
                                    ', Details: ',
                                    errorThrown);
                                console.error('Response: ', jqXHR.responseText);
                                alert('An error occurred when creating child routes:\n' + jqXHR.responseText);
                        }
                })
        }

        // Get the full details of the specified route. You should largely
        // have this done from the previous exercise. Make sure you pass
        // `callback` as the `success` callback function in the Ajax call.
        function getRouteById(routeId, callback) {
                // FILL THIS IN

                $.ajax({
                        method:'GET',
                        url: baseUrl + '/Routes/' + routeId,
                        contentType: 'application/json',
                        success: (route) => callback(route),
                        error: function ajaxError(jqXHR, textStatus, errorThrown) {
                                console.error(
                                    'Error getting route: ',
                                    textStatus,
                                    ', Details: ',
                                    errorThrown);
                                console.error('Response: ', jqXHR.responseText);
                                alert('An error occurred when getting the route:\n' + jqXHR.responseText);
                        }
                })

        }
        // Get city data (names, locations, etc.) from your new Lambda that returns
        // that information. Make sure you pass `callback` as the `success` callback
        // function in the Ajax call.
        function fetchCityData(callback) {
                // FILL THIS IN
                console.log(baseUrl + '/city-data');
                $.ajax({
                        method: 'GET',
                        url: baseUrl + '/city-data',
                        contentType: 'application/json',
                        success: (cityData) => callback(cityData),
                        error: function ajaxError(jqXHR, textStatus, errorThrown) {
                                console.error(
                                    'Error getting city data: ',
                                    textStatus,
                                    ', Details: ',
                                    errorThrown);
                                console.error('Response: ', jqXHR.responseText);
                                alert('An error occurred when getting city data:\n' + jqXHR.responseText);
                        }
                })

        }
        ////////////////////////////////////////////////////////////
        // START OF HTML DISPLAY ///////////////////////////////////
        ////////////////////////////////////////////////////////////
        // The next few functions handle displaying different values
        // in the HTML of the web app. This is all complete and you
        // shouldn't have to do anything here, although you're welcome
        // to modify parts of this if you want to change the way
        // things look.
        // A few of them are complete as is (`stPath()` and
        // `displayChildren()`), while others need to be written:
        //
        // - `displayRoute()`
        // - `stRoutes()`
        // Display the details of the best path. This is complete,
        // but you can fancy it up if you wish.
        function displayBestPath() {
                $("#best-length").text(best.len);
                $("#best-path").text(JSON.stringify(best.bestPath));
                $("#best-routeId").text(best.routeId);
                $("#best-route-cities").text("");
                best.bestPath.forEach((index) => {
                        const cityName = cityData[index].properties.name;
                        $("#best-route-cities").append(`<li>${cityName}</li>`);
                });
        }
        // Display all the children. This just uses a `forEach`
        // to call `displayRoute` on each child route. This

        // should be complete and work as is.
        function displayChildren(children, dc_cb) {
        //  $('#new-route-list').text("");
                children.forEach(child => displayRoute(child));
                dc_cb(null, children);
        }
        // Display a new (child) route (ID and length) in some way.
        // We just appended this as an `<li>` to the `new-route-list`
        // element in the HTML.
        function displayRoute(result) {
                // FILL THIS
                console.log('New route received from API: ', result);
                let length = result.len;
                let routeId = result.routeId;

                console.log("//////////// HERE /////////////");
                console.log(length);
                console.log(routeId);

                $('#new-route-list').append(`<li>We generated route ${routeId} with len ${length}`);
        }
        // Display the best routes (length and IDs) in some way.
        // We just appended each route's info as an `<li>` to
        // the `best-route-list` element in the HTML.
        //
        // MAKE SURE YOU END THIS with
        //
        // dbp_cb(null, bestRoutes);
        //
        // so the array of best routes is pass along through
        // the waterfall in `runGeneration`.
        function displayBestRoutes(bestRoutes, dbp_cb) {
                // FILL THIS IN
            //    console.log("best routes:" + JSON.stringify(bestRoutes));
                $("#best-route-list").append(`<li>${bestRoutes[0].routeId} (${bestRoutes[0].len})</li>`);
                dbp_cb(null, bestRoutes);
        }
        ////////////////////////////////////////////////////////////
        // END OF HTML DISPLAY /////////////////////////////////////
        ////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////
        // START OF TRACKING BEST ROUTE ////////////////////////////
        ////////////////////////////////////////////////////////////
        // The next few functions keep track of the best route we've seen
        // so far. They should all be complete and not need any changes.
        function updateBestRoute(children, ubr_cb) {
                children.forEach(child => {
                        if (child.len < best.len) {
                                updateBest(child.routeId);
                        }
                });
                ubr_cb(null, children);
        }

        // This is called whenever a route _might_ be the new best
        // route. It will get the full route details from the appropriate
        // Lambda, and then plot it if it's still the best. (Because of
        // asynchrony it's possible that it's no longer the best by the
        // time we get the details back from the Lambda.)
        //
        // This is complete and you shouldn't have to modify it.
        function updateBest(routeId) {
          console.log(" *********** HERE ***********");
          console.log(routeId);
                getRouteById(routeId, processNewRoute);
                function processNewRoute(route) {
                        // We need to check that this route is _still_ the
                        // best route. Thanks to asynchrony, we might have
                        // updated `best` to an even better route between
                        // when we called `getRouteById` and when it returned
                        // and called `processNewRoute`. The `route == ""`
                        // check is just in case we our attempt to get
                        // the route with the given idea fails, possibly due
                        // to the eventual consistency property of the DB.
                        if (best.len > route.len && route == "") {
                                console.log(`Getting route ${routeId} failed; trying again.`);
                                updateBest(routeId);
                                return;
                        }
                        if (best.len > route.len) {
                                console.log(`Updating Best Route for ${routeId}`);
                                best.routeId = routeId;
                                best.len = route.len;
                                best.bestPath = route.route;
                                displayBestPath(); // Display the best route on the HTML page
                                best.bestPath[route.route.length] = route.route[0]; // Loop Back
                                updateMapCoordinates(best.bestPath);
                                mapCurrentBestRoute();
                        }
                }
        }
        ////////////////////////////////////////////////////////////
        // END OF TRACKING BEST ROUTE //////////////////////////////
        ////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////
        // START OF MAPPING TOOLS //////////////////////////////////
        ////////////////////////////////////////////////////////////

        // The next few functions handle the mapping of the best route.
        // This is all complete and you shouldn't have to change anything
        // here.
        // Uses the data in the `best` global variable to draw the current
        // best route on the Leaflet map.
        function mapCurrentBestRoute() {
                var lineStyle = {
                        dashArray: [10, 20],
                        weight: 5,
                        color: "#0000FF",
                };
                var fillStyle = {
                        weight: 5,
                        color: "#FFFFFF",
                };
                if (best.lRoute[0].length == 0) {
                        // Initialize first time around
                        best.lRoute[0] = L.polyline(best.coords, fillStyle).addTo(mymap);
                        best.lRoute[1] = L.polyline(best.coords, lineStyle).addTo(mymap);
                } else {
                        best.lRoute[0] = best.lRoute[0].setLatLngs(best.coords);
                        best.lRoute[1] = best.lRoute[1].setLatLngs(best.coords);
                }
        }
        function initializeMap(cities) {
                cityData = [];
                for (let i = 0; i < cities.length; i++) {
                        const city = cities[i];
                        const cityName = city.cityName;
                        var geojsonFeature = {
                                type: "Feature",
                                properties: {
                                        name: "",
                                        show_on_map: true,
                                        popupContent: "CITY",
                                },
                                geometry: {
                                        type: "Point",
                                        coordinates: [0, 0],
                                },
                        };
                        geojsonFeature.properties.name = cityName;
                        geojsonFeature.properties.popupContent = cityName;
                        geojsonFeature.geometry.coordinates[0] = city.location[1];
                        geojsonFeature.geometry.coordinates[1] = city.location[0];
                        cityData[i] = geojsonFeature;
                }
                var layerProcessing = {
                        pointToLayer: circleConvert,
                        onEachFeature: onEachFeature,
                };
                L.geoJSON(cityData, layerProcessing).addTo(mymap);
                function onEachFeature(feature, layer) {
                        // does this feature have a property named popupContent?
                        if (feature.properties && feature.properties.popupContent) {
                                layer.bindPopup(feature.properties.popupContent);
                        }
                }
                function circleConvert(feature, latlng) {
                        return new L.CircleMarker(latlng, { radius: 5, color: "#FF0000" });
                }
        }
        // This updates the `coords` field of the best route when we find
        // a new best path. The main thing this does is reverse the order of
        // the coordinates because of the mismatch between tbe GeoJSON order
        // and the Leaflet order.
        function updateMapCoordinates(path) {
                function swap(arr) {
                        return [arr[1], arr[0]];
                }
                for (var i = 0; i < path.length; i++) {
                        best.coords[i] = swap(cityData[path[i]].geometry.coordinates);
                }
                best.coords[i] = best.coords[0]; // End where we started
        }
        ////////////////////////////////////////////////////////////
        // END OF MAPPING TOOLS ////////////////////////////////////
        ////////////////////////////////////////////////////////////
        $(function onDocReady() {
                // These set you up with some reasonable defaults.
                $("#population-size-text-field").val(100);
                $("#num-parents").val(20);
                $("#num-generations").val(20);
                $("#run-evolution").click(runEvolution);
                // Get all the city data (names, etc.) once up
                // front to be used in the mapping throughout.
                fetchCityData(initializeMap);
        });
})(jQuery);
```
### HTML
```HTML
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Evolving Solutions to The Traveling Salesman Problem</title>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="description" content="Evolving solutions to a TSP instance" />
    <meta name="author" content="Cassandra Schultz" />

    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
      integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
      crossorigin=""
    />
    <link rel="stylesheet" href="styles.css">
    <!-- Make sure you put this AFTER Leaflet's CSS -->
    <script
      src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"
      integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA=="
      crossorigin=""></script>
  </head>

  <body>
    <h1>Evolving Solutions to The Traveling Salesman Problem</h1>
    <div>
      <h2>"Global" parameters</h2>

      <label for="runId-text-field">Run ID:</label>
      <input type="text" id="runId-text-field" />

      <label for="population-size-text-field">Population size:</label>
      <input type="text" id="population-size-text-field" />

      <label for="num-parents">Number of parents to keep:</label>
      <input type="text" id="num-parents" />
    </div>

    <div id="map" style="height: 500px; width: 500px"></div>
    <div id="best-run-routes">
      <h2>Best so far</h2>
      <ul>
        <li>Best <code>routeId</code>: <span id="best-routeId"></span></li>
        <li>Best length: <span id="best-length"></span></li>
        <li>
          Best path: <span id="best-path"></span>
          <ol id="best-route-cities"></ol>
        </li>
        <li>
          Current threshold: <span id="current-threshold"></span>
        </li>
      </ul>
    </div>

    <div class="run-evolution">
      <h2>Evolve solutions!</h2>

      <label for="num-generations">How many generations to run?</label>
      <input type="text" id="num-generations" />

      <button id="run-evolution">Run evolution</button>
    </div>

    <div class="current-generation">
      <h2>Current generation: <span id="current-generation"></span></h2>
      <div id="new-routes">
        <ol id="new-route-list"></ol>
      </div>
    </div>

    <div class="get-best-routes">
      <h2>Best routes from previous generation</h2>
      <div id="best-routes">
        <ol id="best-route-list"></ol>
      </div>
    </div>

    <script src="vendor/jquery-3.6.0.min.js"></script>
    <script src="vendor/async.min.js"></script>
    <script src="evotsp.js"></script>
    <script>
      var mymap = L.map("map").setView([46.7296, -94.6859], 6); //automate or import view for future

      L.tileLayer(
        "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
        {
          attribution:
            'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
          maxZoom: 18,
          id: "mapbox/streets-v11",
          tileSize: 512,
          zoomOffset: -1,
          accessToken:
            "myToken",


        }
      ).addTo(mymap);
    </script>
  </body>
</html>

```

