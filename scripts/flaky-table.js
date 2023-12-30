VSS.init({
    explicitNotifyLoaded: true,
    usePlatformStyles: true 
});

VSS.require([
    "TFS/Dashboards/WidgetHelpers", 
    "TFS/Dashboards/Services"
    ],
    function (WidgetHelpers, DashboardServices) {
        WidgetHelpers.IncludeWidgetStyles();
        VSS.register("flaky-tests-table", function () { 
            return{
                load: function(widgetSettings){
                    var $title = $('h2.title');
                    $title.text(widgetSettings.name);
                    if(!widgetSettings || !widgetSettings.customSettings || !widgetSettings.customSettings.data)
                    {
                        return showConfigureWidget(widgetSettings, DashboardServices, WidgetHelpers);
                    }
                    var settings = JSON.parse(widgetSettings.customSettings.data);
                    if(!settings.branch || !settings.pipeline || !settings.reason || !settings.days || settings.days=="" || settings.days < 1 || isNaN(settings.days))
                    {
                        return showConfigureWidget(widgetSettings, DashboardServices, WidgetHelpers);
                    }

                    return VSS.getAccessToken()
                    .then(function(tokenObject) {
                        var token = tokenObject.token;
                        var projectName = VSS.getWebContext().project.name;
                        var definitionId = settings.pipeline;
                        var organization = VSS.getWebContext().account.name;
                        fetchBuildData(token, projectName, definitionId, settings.branch, organization, settings.reason, settings.days)
                        .then(data => {
                            if(data.count < 1) {
                                var $container = $('#Chart-Container');
                                $container.text('At least 1 build is required to show a chart.');
                                return WidgetHelpers.WidgetStatusHelper.Success();
                            }
                            var buildData = data.value.map(build => ({ id: build.id, finishTime: build.finishTime }));
                            return buildData;
                        })
                        .then(buildData => fetchTestData(token, projectName, organization, buildData))
                        .then(testData => getFailedTests(token, projectName, organization, testData).then(failedTests => ({ testData, failedTests })))
                        .then(({ testData, failedTests }) => {
                            var flakyTests = createFlakeTestTableData(testData,failedTests);
                            // var $container = $('#Chart-Container');
                            // var chartOptions = getChartOptions(testData, widgetSettings.size.rowSpan);
                            // chartService.createChart($container, chartOptions);
                            return WidgetHelpers.WidgetStatusHelper.Success();
                        });                            
                    });
                }
            }
        });
        VSS.notifyLoadSucceeded();
    }
);

function createFlakeTestTableData(testData, failedTests) {
    var table = [];
    for(var f = 0; f < failedTests.length; f++) {
        var runs = [];
        var testCaseReferenceId = failedTests[f].testCaseReferenceId
        var testCaseName = failedTests[f].automatedTestName;
        for(var i = testData.length-1; i >= 0 ; i--) {
            var testSet = testData[i];
            var testExists = false;
            for(var j = 0; j < testSet.data.resultsForGroup[0].results.length; j++) {
                var test = testSet.data.resultsForGroup[0].results[j];
                if(test.testCaseReferenceId == testCaseReferenceId) {
                    runs.push(test.outcome);
                    testExists = true;
                    break;
                }
            }
            if(testExists == false) {
                runs.push('n/a');
            }
        }

        table.push({testCaseName, runs});
    }

    // remove all tests that have runs that end with n/a
    var removeTests = [];
    for(var i = 0; i < table.length; i++) {
        if(table[i].runs[table[i].runs.length-1] == 'n/a') {
            removeTests.push(i);
        }
    }
    for(var i = removeTests.length-1; i >= 0; i--) {
        table.splice(removeTests[i], 1);
    } 

    console.log("table start");
    console.log(table);
    console.log("table end");
    
    return table;
}


function showConfigureWidget(widgetSettings, dashboardServices, widgetHelpers) {
    $('#Configure-Widget').css('display', 'block');
    var height = 70;
    if(widgetSettings.size.rowSpan == 3) {
        height = 150;
    }
    $('#Configure-Widget-Text').css('margin-top', height + 'px');

    dashboardServices.WidgetHostService.getService().then((DashboardServiceHost) => {
        DashboardServiceHost.showConfiguration() // This is what you want to hook up to your onClick event to show the widget configuration modal.
    });
    return widgetHelpers.WidgetStatusHelper.Unconfigured();
}

function fetchBuildData(token, projectName, definitionId, branchFilter, organization, reason, days) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    var minDate = date.toISOString().slice(0,10);

    var url = `https://dev.azure.com/${organization}/${projectName}/_apis/build/builds?definitions=${definitionId}&branchName=${branchFilter}&reasonFilter=${reason}&minTime=${minDate}&api-version=7.1`;
    return fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    }).then(response => response.json());
}

function fetchTestData(token, projectName,  organization, buildData) {    
    var promises = [];
    buildData.forEach(build => {
        var url = `https://vstmr.dev.azure.com/${organization}/${projectName}/_apis/testresults/resultdetailsbybuild?buildId=${build.id}&api-version=7.2-preview.1`;
        var promise = fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        }).then(response => response.json())
        .then(data => ({data, finishTime: build.finishTime, url: `https://dev.azure.com/${organization}/${projectName}/_build/results?buildId=${build.id}&view=results`}));

        promises.push(promise);
    });

    return Promise.all(promises);
}

function getFailedTests(token, projectName,  organization, testData) {  
    var failedTests = [];
    var failedTestIds = [];
    testData.forEach(testRun => {
        testRun.data.resultsForGroup[0].results.forEach(test => {
            runId = test.testRun.id;
            resultId = test.id;
            referenceId = test.testCaseReferenceId;
            if(test.outcome == 'Failed' && test.testCaseReferenceId != null && failedTestIds.includes(referenceId) == false) {
                failedTests.push({referenceId,runId,resultId});
                failedTestIds.push(referenceId);
            }
        });
    });

    var promises = [];
    failedTests.forEach(failed => {
        var url = `https://vstmr.dev.azure.com/${organization}/${projectName}/_apis/testresults/runs/${failed.runId}/results/${failed.resultId}?api-version=7.2-preview.2`;
        var promise = fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        }).then(response => response.json());
        promises.push(promise);
    });

    return Promise.all(promises);
}