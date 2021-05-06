const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
    const pathParameters = event.pathParameters;
    const routeId1 = pathParameters.routeId;

    console.log(routeId1);

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
