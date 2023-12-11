VSS.init({
    explicitNotifyLoaded: true,
    usePlatformStyles: true 
});

VSS.require([
    "TFS/Dashboards/WidgetHelpers", 
    "Charts/Services"
    ],
    function (WidgetHelpers, Services, buildClient) {
    WidgetHelpers.IncludeWidgetStyles();
    VSS.register("nightly-chart", function () { 
         return {
         load:function() {
            return Services.ChartsService.getService().then(function(chartService){

                VSS.getAccessToken().then(function(tokenObject) {
                    var token = tokenObject.token;
                    var projectName = VSS.getWebContext().project.name;
                    var definitionId = 17;
                    var branchFilter = "refs/heads/main";
                    var organization = VSS.getWebContext().account.name;
                    fetchBuildData(token, projectName, definitionId, branchFilter, organization)
                .then(data => {
                    console.log(data);
                    var buildIds = data.value.map(build => build.id).join(',');
                    return fetchTestData(token, projectName, buildIds, organization);
                })
                .then(testData => {
                    console.log(testData);
                    testData.value.forEach(test => {
                        console.log(`Passed: ${test.passedTests}, Total: ${test.totalTests}`);
                    });
                });

                var $container = $('#Chart-Container');
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
                            "data": [100,100,105,105,105,107,107],
                            "color": "#207752"
                        },
                        {
                            "name": "Failed",
                            "data": [1,1,1,1,0,0,0],
                            "color": "#FF0000"
                        }
                    ],
                    "xAxis": {
                        "labelFormatMode": "dateTime_DayInMonth",
                        "labelValues": [
                            "1/1/2016",
                            "1/2/2016",
                            "1/3/2016",
                            "1/4/2016",
                            "1/5/2016",
                            "1/6/2016",
                            "1/7/2016",
                            "1/8/2016",
                            "1/9/2016",
                            "1/10/2016"
                        ]
                    },
                    "specializedOptions": {
                        "includeMarkers": true
                    }
                };

                chartService.createChart($container, chartOptions);
                return WidgetHelpers.WidgetStatusHelper.Success();
            });
            }
         }
        });
VSS.notifyLoadSucceeded();
});

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

function fetchTestData(token, projectName, buildIds, organization) {
    var testUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/runs?buildIds=${buildIds}&api-version=7.1`;

    return fetch(testUrl, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json());
}