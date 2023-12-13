VSS.init({
    explicitNotifyLoaded: true,
    usePlatformStyles: true 
});

VSS.require([
    "TFS/Dashboards/WidgetHelpers", 
    "Charts/Services"
    ],
    function (WidgetHelpers, Services) {
        WidgetHelpers.IncludeWidgetStyles();
        VSS.register("nightly-chart", function () { 
            return{
                load:function(widgetSettings){
                    var $title = $('h2.title');
                    $title.text(widgetSettings.name);

                    var settings = JSON.parse(widgetSettings.customSettings.data);
                    var selectedBranch = settings.branch;

                    return Services.ChartsService.getService()
                    .then(function(chartService) {
                        VSS.getAccessToken()
                        .then(function(tokenObject) {
                            var token = tokenObject.token;
                            var projectName = VSS.getWebContext().project.name;
                            var definitionId = 17;
                            var organization = VSS.getWebContext().account.name;
                            fetchBuildData(token, projectName, definitionId, selectedBranch, organization)
                            .then(data => {
                                var buildData = data.value.map(build => ({ id: build.id, finishTime: build.finishTime }));
                                return buildData;
                            })
                            .then((buildData) => fetchTestData(token, projectName, buildData, organization)
                            .then(testData => ({ testData: testData, buildData: buildData })))
                            .then(({ testData, buildData }) => {

                                // filter out buildData that doesn't have test data
                                var buildIds = testData.value.map(test => +test.build.id);
                                buildData = buildData.filter(build => buildIds.includes(build.id));
                                var finishTimes = buildData.map(build => build.finishTime).reverse();

                                var testResults = testData.value.map((test, index) => {
                                    var failedTests = test.totalTests - test.passedTests;
                                    return { 
                                        passedTests: test.passedTests, 
                                        failedTests: failedTests, 
                                        url: test.webAccessUrl, 
                                        finishTime: finishTimes[index] 
                                    };
                                });
                                var $container = $('#Chart-Container');
                                var chartOptions = getChartOptions(testResults);
                                chartService.createChart($container, chartOptions);
                                return WidgetHelpers.WidgetStatusHelper.Success();
                            });                            
                        });
                    });
                }
            }
        });
        VSS.notifyLoadSucceeded();
    }
);

function fetchBuildData(token, projectName, definitionId, branchFilter, organization) {
    var url = `https://dev.azure.com/${organization}/${projectName}/_apis/build/builds?definitions=${definitionId}&branchName=${branchFilter}&api-version=7.1`;
    return fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json());
}

function fetchTestData(token, projectName, buildData, organization) {
    var buildIds = buildData.map(build => build.id).join(',');
    var testUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/runs?buildIds=${buildIds}&includeRunDetails=true&api-version=7.1`;

    return fetch(testUrl, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json());
}

function getChartOptions(testResults) {
    var passedData = testResults.map(result => result.passedTests);
    var failedData = testResults.map(result => result.failedTests);



    var chartOptions ={ 
        "hostOptions": { 
            "height": "290", 
            "width": "300",
            "title": "Nightlies",
        },
        "chartType": "stackedArea",
        "series": [
            {
                "name": "Passed",
                "data": passedData,
                "color": "#207752"
            },
            {
                "name": "Failed",
                "data": failedData,
                "color": "#FF0000"
            }
        ],
        "xAxis": {
            "labelFormatMode": "dateTime_DayInMonth",
            "labelValues": testResults.map(result => result.finishTime),
        },
        "click":(e) => {
            window.open(testResults[e.seriesDataIndex].url);
        },
        "specializedOptions": {
            "includeMarkers": true
        }
    };
    return chartOptions;
}