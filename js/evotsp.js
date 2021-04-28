(function evoTSPwrapper($) {

    // You'll need to replace this with the URL you get when you
    // deploy your API Gateway.
    const baseUrl = 'https://au293wdqh6.execute-api.us-east-1.amazonaws.com/prod';
    console.log(`The base URL is ${baseUrl}.`);

    // Set up the functions to be called when the user clicks on any
    // of the three buttons in our (very simple) user interface.
    // We provided `randomRoutes()` for you, but you have to implement
    // `getBestRoutes()` and `getRouteById()`.
    $(function onDocReady() {
        $('#generate-random-routes').click(randomRoutes);
        $('#get-best-routes').click(getBestRoutes);
        $('#get-route-by-id').click(getRouteById);
    });

    // This generates a single random route by POSTing the
    // runId and generation to the `/routes` endpoint.
    // It's asynchronous (like requests across the network
    // typically are), and the showRoute() function is called
    // when the request response comes in.
    function randomRoute(runId, generation) {
        $.ajax({
            method: 'POST',
            url: baseUrl + '/routes',
            data: JSON.stringify({
                runId: runId,
                generation: generation
            }),
            contentType: 'application/json',
            // When a request completes, call `showRoute()` to display the
            // route on the web page.
            success: showRoute,
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

    // Generates a collection of new routes, where the number to generate
    // (and the runId and generation) are specified in the HTML text
    // fields. Note that we don't do any kind of sanity checking here, when
    // it would make sense to at least ensure that `numToGenerate` is a
    // non-negative number.
    //
    // This uses the `async` library (https://caolan.github.io/async/v3/docs.html)
    // to place the requests asynchronously, so we can benefit from parallel
    // computation on the AWS end. You can get burned, though, if you set
    // numToGenerate too high as there are a host of AWS capacity limits that
    // you might exceed, leading to a failed HTTP requests. I've had no trouble
    // with up to 500 at a time, but 1,000 regularly breaks things.
    //
    // We never do anything with the `event` argument because we know what
    // button was clicked and don't care about anything else.
    function randomRoutes(event) {
        const runId = $('#runId-text-field').val();
        const generation = $('#generation-text-field').val();
        const numToGenerate =$('#num-to-generate').val();
        // Reset the contents of `#new-route-list` so that it's ready for
        // `showRoute()` to "fill" it with the incoming new routes.
        $('#new-route-list').text('');
        //
        async.times(numToGenerate, () => randomRoute(runId, generation));
    }

    // When a request for a new route is completed, add an `<li>…</li>` element
    // to `#new-route-list` with that routes information.
    function showRoute(result) {
        console.log('New route received from API: ', result);
        const routeId = result.routeId;
        const length = result.length;
        $('#new-route-list').append(`<li>We generated route ${routeId} with length ${length}.</li>`);
    }

    // Make a `GET` request that gets the K best routes.
    // The form of the `GET` request is:
    //   …/best?runId=…&generation=…&numToReturn=…
    // This request will return an array of
    //    { length: …, routeId: …}
    // You should add each of these to `#best-route-list`
    // (after clearing it first).
    function bestRoutes(runId, generation, numToReturn) {
        $.ajax({
            method:'GET',
            url: baseUrl + `/best?runId=${runId}&generation=${generation}&numToReturn=${numToReturn}`,
            contentType: 'application/json',
            success: showBestRoutes,
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

    function getBestRoutes(event){
        const runId = $('#runId-text-field').val();
        const generation = $('#generation-text-field').val();
        const numToReturn=$('#num-best-to-get').val();

        $('#best-route-list').text('');
        bestRoutes(runId, generation, numToReturn);

    }

    function showBestRoutes(result) {
      for (let i = 0; i < result.length; i++) {
        const routeId = result[i].routeId;
        const length = result[i].length;

        $('#best-route-list').append(`<li>${length} (${routeId})</li>`);
      }
    }


    // Make a `GET` request that gets all the route information
    // for the given `routeId`.
    // The form of the `GET` request is:
    //   …/routes/:routeId
    // This request will return a complete route JSON object.
    // You should display the returned information in
    // `#route-by-id-elements` (after clearing it first).
    function routeById(routeId) {
        $.ajax({
            method:'GET',
            url:baseUrl + '/routes/' + routeId,
            contentType: 'application/json',
            success: showRouteById,
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

    function getRouteById() {
        const routeId = $('#route-ID').val();
        $('route-by-id').text('');
        routeById(routeId);
    }

    function showRouteById(result) {
        console.log('New route received from API: ', result);

        const partitionKey = result[0].partitionKey;
        const routeId = result[0].routeId;
        const length = result[0].length;
        const route = result[0].route;

        $('#route-by-id-elements').append(`<li>Parition Key: ${partitionKey}</li><br>  <li>Route ID: ${routeId}</li><br><li>Length: ${length} </li><br><li>Route: ${route}</li>`);
    }

}(jQuery));
