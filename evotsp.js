(function evoTSPwrapper($) {
        const baseUrl =
            "https://au293wdqh6.execute-api.us-east-1.amazonaws.com/prod";
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
                            `Initializing pop for runId = ${runId} with pop size ${populationSize},
        ↪ generation = ${initialGeneration}`
                        );
                        $("#new-route-list").text("");
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

                        success: (displayRoute) => callback(null, displayRoute),
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
                generation = $('#num-generations').val();

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
                        success: (children) => callback(null, children),
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
                        success: (route) => callback(null, route),
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
        // A few of them are complete as is (`displayBestPath()` and
        // `displayChildren()`), while others need to be written:
        //
        // - `displayRoute()`
        // - `displayBestRoutes()`
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
                children.forEach(child => displayRoute(child));
                dc_cb(null, children);
        }
        // Display a new (child) route (ID and length) in some way.
        // We just appended this as an `<li>` to the `new-route-list`
        // element in the HTML.
        function displayRoute(result) {
                // FILL THIS
                console.log('New route received from API: ', result);
                const length = result.len;
                const routeId = result.routeId;

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
                console.log('Best route received from API: ', bestRoutes);

                const length = bestRoutes[0].len;
                const routeId = bestRoutes[0].routeId;
                const route = bestRoutes[0].route;
                const runGen = bestRoutes[0].runGen;
                $('#best-route-list').append(`<li><b>Route:</b> ${route}, <b>Length:</b> ${length}, <b>RouteId:</b> ${routeId}</li>`);
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
