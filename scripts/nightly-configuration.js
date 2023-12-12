VSS.init({                        
    explicitNotifyLoaded: true,
    usePlatformStyles: true
});

VSS.require("TFS/Dashboards/WidgetHelpers", function (WidgetHelpers) {
    WidgetHelpers.IncludeWidgetConfigurationStyles();
    VSS.register("nightly-chart.Configuration", function () {   
        return {
            load: function (widgetSettings, widgetConfigurationContext) {
        
                var $repositoryDropdown = $("#repository-dropdown");
                var $branchDropdown = $("#branch-dropdown");
                var $pipelineDropdown = $("#pipeline-dropdown");
                
                getRepositoryData()
                .then(repos => {
                    repos.forEach(repo => {
                        var option = document.createElement('option');
                        option.text = repo.name;
                        option.value = repo.id;
                        $repositoryDropdown.append(option);
                    });
                });

                $repositoryDropdown.change(function() {
                    var selectedRepositoryId = this.value;
                    $branchDropdown.empty(); // clear the branch dropdown
                    getBranchData(selectedRepositoryId)
                        .then(branches => {
                            branches.forEach(branch => {
                                var option = document.createElement('option');
                                option.text = branch.name;
                                option.value = branch.id;
                                $branchDropdown.append(option);
                            });
                        });
                });

                getPipelineData()
                .then(pipelines => {
                    pipelines.forEach(pipeline => {
                        var option = document.createElement('option');
                        option.text = pipeline.name;
                        option.value = pipeline.id;
                        $pipelineDropdown.append(option);
                    });
                });              

                var settings = JSON.parse(widgetSettings.customSettings.data);
                if (settings && settings.branch) {
                    $branchDropdown.val(settings.branch);
                }
                $branchDropdown.on("change", function () {
                    var customSettings = {data: JSON.stringify({branch: $branchDropdown.val()})};
                    var eventName = WidgetHelpers.WidgetEvent.ConfigurationChange;
                    var eventArgs = WidgetHelpers.WidgetEvent.Args(customSettings);
                    widgetConfigurationContext.notify(eventName, eventArgs);
                });
                return WidgetHelpers.WidgetStatusHelper.Success();
            },
            onSave: function() {
                var customSettings = {
                    data: JSON.stringify({
                            branch: $branchDropdown.val()
                        })
                };
                return WidgetHelpers.WidgetConfigurationSave.Valid(customSettings); 
            }
        }
    });
    VSS.notifyLoadSucceeded();
});

function getPipelineData() {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines?api-version=7.1`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(pipeline => ({name: pipeline.name, id: pipeline.id})))
            .then(pipelines => pipelines.sort((a, b) => a.name.localeCompare(b.name)));
        });
}

function getBranchData(repositoryId) {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/git/repositories/${repositoryId}/refs?filter=heads&api-version=6.0`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(branch => ({name: branch.name.replace('refs/heads/', ''), id: branch.name})))
            .then(branches => branches.sort((a, b) => a.name.localeCompare(b.name)));
        });
}

function getRepositoryData() {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/git/repositories?api-version=6.0`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(repo => ({name: repo.name, id: repo.id})))
            .then(repos => repos.sort((a, b) => a.name.localeCompare(b.name)));
        });
}