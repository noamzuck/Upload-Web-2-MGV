let uploaded = 0, uploading = 0, failedUps = 0; //The variables for the upload process
let UploadFilesMGVId, globalFile, globalFileLink, port; //The global variables
(async () => {
  await fetch('/port').then(res => res.json()).then(json => port = json.port);
})();

window.addEventListener('load', async () => {
    if(await localStorage.getItem('UploadFilesMGVId') == null) {
        await fetch('/createAccount')
        .then(res => res.json())
        .then(json => localStorage.setItem('UploadFilesMGVId', json.insertedId));
    }//Checks if an account is already existing
    UploadFilesMGVId = await localStorage.getItem('UploadFilesMGVId');

    //Gets the user's information
    await fetch(`/getUser?id=${UploadFilesMGVId}`)
    .then(res => res.json())
    .then(json => {
        const doneDiv = document.getElementById('doneDiv');
        for(let file of json.files) {
            uploaded++;
            document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
            document.getElementById('uploadHistory').innerHTML++;
            //Updates the progress of the uploads

            const time = Date.now();
            const encodeId = encodeURIComponent(file).replace(/[^a-zA-Z0-9]/g, '');
            const uploadItem = document.createElement('div');
            uploadItem.id = encodeId + time + 'Item';
            uploadItem.classList.add('uploadItem');
            doneDiv.insertBefore(uploadItem, doneDiv.firstChild);
            const insideUploadItem = `\
                <button class='uploadCancelBtn' style='background-color: var(--b); cursor: default;'>\
                    <i class='fa-solid fa-check'></i>\
                </button>\
                <p class='uploadTitleItem'>${file}</p>\
                <div class='uploadBtnsDiv'>\
                  <button class='uploadDeleteAndShareBtn deleteBtnFix' onclick="deleteFile('${file}', '${encodeId + time + 'Item'}')">\
                      Delete file
                      <i class="fa fa-trash" style='margin: 0 0.5vw;'></i>
                  </button>\
                  <button class='uploadDeleteAndShareBtn shareBtnFix' onclick="shareFile('${file}')">\
                      Share file
                      <i class="fa-solid fa-share" style='margin: 0 0.5vw;'></i>
                  </button>\
                </div>\
            `;
            uploadItem.innerHTML = insideUploadItem;
        }//Creates an item for each file
    })
    .catch(async err => {
        if(err == `SyntaxError: Unexpected token 'U', "User not found" is not valid JSON`) {
            await fetch('/createAccount')
            .then(res => res.json())
            .then(json => localStorage.setItem('UploadFilesMGVId', json.insertedId));
            UploadFilesMGVId = await localStorage.getItem('UploadFilesMGVId');
            location.reload();
        } //Checks for errors to see if the account ID is existing
    });

    if(document.getElementById("statsDivOne") != null) await getStats();
}); //Waits till the page is loaded

function drag(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dropDiv');
} //The function that is called when the user drags a file

function cancelDraging(event) {
    event.currentTarget.classList.remove('dropDiv');
} //The function that is called when the user cancels the drag

function drop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dropDiv');

    const files = event.dataTransfer.files;
    uploadFiles(files);
} //The function that is called when the user drops a file

function toggleIcon() {
    document.getElementById('arrowI').classList.toggle('arrowIconHover');
} //The function that is called when the user put the mouse over the menu button

function menu() {
    const menu = document.getElementById('sideUploads');
    menu.style.display = (menu.style.display == 'flex') ? 'none' : 'flex';
    menu.classList.toggle('sideUploadsDivLeave');
    document.getElementById('arrowI').classList.toggle('fa-angle-left');
    document.getElementById('arrowI').classList.toggle('fa-angle-right');
} //The function that is called when the user clicks on the menu button

async function uploadFiles(files) {
    const uploadingDiv = document.getElementById('uploadingDiv');
    const doneDiv = document.getElementById('doneDiv');
    for(let file of files) {
        uploading++;
        document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
        document.getElementById('uploadHistory').innerHTML++;
        //Updates the progress of the uploads

        const time = Date.now();
        const encodeId = encodeURIComponent(file.name).replace(/[^a-zA-Z0-9]/g, '');
        const uploadItem = document.createElement('div');
        uploadItem.id = encodeId + time + 'Item';
        uploadItem.classList.add('uploadItem');
        uploadingDiv.appendChild(uploadItem);
        const controller = new AbortController();
        const signal = controller.signal;
        const insideUploadItem = `\
            <button id='${encodeId}${time}Btn' class='uploadCancelBtn'>\
                <i class='fa-solid fa-xmark'></i>\
            </button>\
            <p id='${encodeId + time}Title' class='uploadTitleItem'>${file.name}</p>\
            <div id='${encodeId + time}ContBar' class='uploadContainerBarItem'>\
                <div id='${encodeId + time}Bar' class='uploadBarItem'>\
                    <p id='${encodeId + time}P' class='uploadPItem'>0%</p>\
                </div>\
            </div>\
        `;
        uploadItem.innerHTML = insideUploadItem;
        document.getElementById(encodeId + time + 'Btn').onclick = async () => {
            controller.abort();
            uploadItem.classList.toggle('uploadItemRemove');
            await new Promise(r => setTimeout(r, 300));
            uploadItem.remove();
        };
        //Creates a new item in the menu

        const formData = new FormData();
        formData.append('file', file);
        formData.append('id', UploadFilesMGVId);

        await fetch('/file', {
            method: 'POST',
            body: formData,
            signal: signal
        })//Sends the file to the server
        .then(res => {
            if(!res.ok) throw new Error('Network response was not ok');
        })//Checks for errors
        .then(() => {
            const startTime = performance.now();
            const reader = new FileReader();

            reader.onprogress = (event) => updateProgress(event, file.name + time);
            //What to do when the upload is in progress

            reader.onload = async () => {
                uploaded++;
                uploading--;
                document.getElementById(encodeId + time + 'ContBar').remove();
                //Removes the progress bar from the item

                const uploadBtnsDiv = document.createElement('div');
                uploadBtnsDiv.classList.add('uploadBtnsDiv');
                uploadBtnsDiv.innerHTML = `\
                  <button class='uploadDeleteAndShareBtn deleteBtnFix' onclick="deleteFile('${file.name}', '${encodeId + time + 'Item'}')">\
                      Delete file
                      <i class="fa fa-trash" style='margin: 0 0.5vw;'></i>
                  </button>\
                  <button class='uploadDeleteAndShareBtn shareBtnFix' onclick="shareFile('${file.name}')">\
                      Share file
                      <i class="fa-solid fa-share" style='margin: 0 0.5vw;'></i>
                  </button>`;
                document.getElementById(encodeId + time + 'Item').appendChild(uploadBtnsDiv);
                //Creates the action buttons in the item

                document.getElementById(encodeId + time + 'Btn').innerHTML = "<i class='fa-solid fa-check'></i>";
                document.getElementById(encodeId + time + 'Btn').style.backgroundColor = 'var(--b)';
                document.getElementById(encodeId + time + 'Btn').style.cursor = "default";
                document.getElementById(encodeId + time + 'Btn').onclick = "";
                //Updates some data in the item

                doneDiv.insertBefore(document.getElementById(encodeId + time + 'Item'), doneDiv.firstChild);
                //Moves the item to the done div

                document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
                //Updates the progress of the uploads

                const endTime = performance.now();
                const duration = parseInt(endTime - startTime);
                await fetch(`/addStat?id=${UploadFilesMGVId}&time=${duration}&size=${file.size}&fileType=${(file.name).split('.')[(file.name).split('.').length - 1]}&date=${(new Date().toLocaleDateString())}`);
                //Sends the stats to the server
            };
            //What to do when the upload is finished
            
            reader.readAsDataURL(file);
        })//When the file is uploaded
        .catch(err => {
            if(err != "AbortError: The user aborted a request.") {//Checks if the error is due to a cancellation by the user
                alert("Uploading the file failed (may be because a file with the same name already exists)");
                failedUps++;
                uploadItem.style.paddingBottom = 0;
                uploadItem.style.outlineColor = 'rgb(189, 0, 0)';
                document.getElementById(encodeId + time + 'Title').style.color = 'rgb(189, 0, 0)';
                document.getElementById(encodeId + time + 'ContBar').className = "uploadBarErrorItem";
                document.getElementById(encodeId + time + 'ContBar').innerHTML = "Upload failed";
                doneDiv.insertBefore(document.getElementById(encodeId + time + 'Item'), doneDiv.firstChild);
                //Updates some data in the item and moves the item to the done div
            }

            uploading--;
            document.getElementById('uploadHistory').innerHTML--;
            document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
            //Updates the progress of the uploads
        });
        //Catches the failed uploads
    }
} //The function that is called when the user wants to upload files

function updateProgress(event, id) {
  if (event.lengthComputable && document.getElementById(id + 'P') != null) {
    const percentComplete = (event.loaded / event.total) * 100;
    document.getElementById(id + 'P').innerHTML = ((percentComplete == null) ? 100 : ((percentComplete.toFixed(2) == 100.00) ? 100 : percentComplete.toFixed(2))) + '%';
    document.getElementById(id + 'Bar').style.width = percentComplete + '%';
  }
} //The function that is called when the upload is in progress

async function deleteFile(file, itemId) {
    const item = document.getElementById(itemId);

    await fetch(`/filename/${file}/${UploadFilesMGVId}`, { method: 'DELETE' })
    .then(res => {
        if(!res.ok) throw new Error('Network response was not ok');
    })
    .then(async () => {
        item.classList.toggle('uploadItemRemove');
        await new Promise(r => setTimeout(r, 300));
        item.remove();
        document.getElementById('uploadHistory').innerHTML--;
        uploaded--;
        document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
    })
    .catch(err => {
        console.error(err);
    });
} //The function that is called when the user wants to delete a file

async function shareFile(file) {
  if(globalFile != file) {
    globalFile = file;
    globalFileLink = `${document.location.href.split(port)[0]}${port}/getFile/${UploadFilesMGVId}/${file}`;
  }
  document.getElementById('shareTitle').innerHTML = globalFile;
  document.getElementById('shareLinkInput').value = globalFileLink;
  document.getElementById('shareBox').classList.toggle('shareBoxOut');
} //The function that is called when the user clicks on the sharing button

async function shareFileAction() {
  await navigator.share({
    title: globalFile,
    text: `You got a link to the file ${globalFile}`,
    url: globalFileLink
  });
} //The function that is called when the user wants to share a file

async function getStats() {
    await fetch('/statistics?id=' + UploadFilesMGVId)
    .then(res => res.json())
    .then(json => {
        new Chart("statsDivOne", {
          type: "line",
          data: {
            labels: json[1].map(item => (item.time / 1000).toFixed(3)),
            datasets: [{ 
              data: json[1].map(item => (item.size / 1024 / 1024).toFixed(2)),
              borderColor: "#12372A",
              fill: false
            }]
          },
          options: {
            legend: {display: false},
            title: {
              display: true,
              text: "Upload time (in seconds) compared to file size (in MB)"
            }
          }
        });
        
        new Chart("statsDivTwo", {
          type: "bar",
          data: {
            labels: Object.keys(json[2]),
            datasets: [{
              backgroundColor: "#12372A",
              data: Object.entries(json[2]).map(([key, value]) => ((value.size / value.amount) / 1024 / 1024).toFixed(2))
            }]
          },
          options: {
            legend: {display: false},
            title: {
              display: true,
              text: "Average file size (in MB) categorized by file type"
            }
          }
        });
        
        new Chart("statsDivThree", {
          type: "line",
          data: {
            labels: Object.keys(json[3]),
            datasets: [{
              fill: false,
              lineTension: 0,
              backgroundColor: "#12372A",
              borderColor: "#12372A",
              data: Object.entries(json[3]).map(([key, value]) => (value / 1024 / 1024).toFixed(2))
            }]
          },
          options: {
            legend: {display: false},
            title: {
              display: true,
              text: "Sorting files by upload date and total daily size (in MB)"
            }
          }
        });
    });
} //The function that is called when the user wants to get the statistics