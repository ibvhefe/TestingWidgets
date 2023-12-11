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
                    var url = `https://dev.azure.com/${organization}/${projectName}/_apis/build/builds?definitions=${definitionId}&branchName=${branchFilter}&api-version=7.1`;

                    fetch(url, {
                        method: 'GET',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log(data);
                        data.value.forEach(build => {
                            var testUrl = `https://dev.azure.com/${organization}/${projectName}/_apis/test/runs?buildIds=${build.id}&api-version=7.1`;
                            fetch(testUrl, {
                                method: 'GET',
                                headers: {
                                    'Authorization': 'Bearer ' + token,
                                    'Content-Type': 'application/json'
                                }
                            })
                            .then(response => response.json())
                            .then(testData => console.log(testData))
                            .catch((error) => console.error('Error:', error));
                        });
                    })
                    .catch((error) => console.error('Error:', error));
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
                        },
                        {
                            "name": "Other",
                            "data": [1,1,1,1,1,0,0],
                            "color": "#909090"
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