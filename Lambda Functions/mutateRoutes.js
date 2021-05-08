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
