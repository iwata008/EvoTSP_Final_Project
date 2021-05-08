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
