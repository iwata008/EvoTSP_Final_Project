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


// Use pathParameterString
// Use ProjectionExpression to only get the 'cities' field
