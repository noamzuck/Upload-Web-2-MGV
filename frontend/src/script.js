let uploaded = 0, uploading = 0, failedUps = 0; //The variables for the upload process
let UploadFilesMGVId, globalFile, globalFileLink, port; //The global variables
let aborted = false;
(async () => {
  await fetch('/port').then(res => res.json()).then(json => port = json.port);
})();

//Waits till the page is loaded
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
            const encodeId = encodeURIComponent(file.replaceAll(/[^a-zA-Z0-9]/g, ''));
            const uploadItem = document.createElement('div');
            uploadItem.id = encodeId + time + 'Item';
            uploadItem.classList.add('uploadItem');
            doneDiv.insertBefore(uploadItem, doneDiv.firstChild);
            const insideUploadItem = `\
                <button class='uploadCancelBtn' style='background-color: var(--b); cursor: default;'>\
                    <i class='fa-solid fa-check'></i>\
                </button>\
                <p class='uploadTitleItem'>${decodeURIComponent(file)}</p>\
                <div class='uploadBtnsDiv'>\
                  <button id='${time}Delete' class='uploadDeleteAndShareBtn deleteBtnFix'>\
                      Delete file
                      <i class="fa fa-trash" style='margin: 0 0.5vw;'></i>
                  </button>\
                  <button id='${time}Share' class='uploadDeleteAndShareBtn shareBtnFix'>\
                      Share file
                      <i class="fa-solid fa-share" style='margin: 0 0.5vw;'></i>
                  </button>\
                </div>\
            `;
            uploadItem.innerHTML = insideUploadItem;
            document.getElementById(`${time}Delete`).onclick = () => deleteFile(file, encodeId + time + 'Item');
            document.getElementById(`${time}Share`).onclick = () => shareFile(file, file);
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
});

//The function that is called when the user drags a file
function drag(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dropDiv');
}

//The function that is called when the user cancels the drag
function cancelDraging(event) {
    event.currentTarget.classList.remove('dropDiv');
}

//The function that is called when the user drops a file
function drop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dropDiv');

    const files = event.dataTransfer.files;
    uploadFiles(files);
}

//The function that is called when the user put the mouse over the menu button
function toggleIcon() {
    document.getElementById('arrowI').classList.toggle('arrowIconHover');
}

//The function that is called when the user clicks on the menu button
function menu() {
    const menu = document.getElementById('sideUploads');
    menu.style.display = (menu.style.display == 'flex') ? 'none' : 'flex';
    menu.classList.toggle('sideUploadsDivLeave');
    document.getElementById('arrowI').classList.toggle('fa-angle-left');
    document.getElementById('arrowI').classList.toggle('fa-angle-right');
}

//The function that is called when the user wants to upload files
async function uploadFiles(files) {
    const uploadingDiv = document.getElementById('uploadingDiv');
    const doneDiv = document.getElementById('doneDiv');
    for(let file of files) {
        //Updates the progress of the uploads
        uploading++;
        document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
        document.getElementById('uploadHistory').innerHTML++;

        //Creates a new item in the menu
        const time = Date.now();
        const encodeId = encodeURIComponent((file.name).replaceAll(/[^a-zA-Z0-9]/g, ''));
        const uploadItem = document.createElement('div');
        uploadItem.id = encodeId + time + 'Item';
        uploadItem.classList.add('uploadItem');
        uploadingDiv.appendChild(uploadItem);
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
            aborted = true;
            xhr.abort();
            uploadItem.classList.toggle('uploadItemRemove');
            await new Promise(r => setTimeout(r, 300));
            uploadItem.remove();
        };
        
        const startTime = performance.now();

        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name));
        formData.append('id', UploadFilesMGVId);
        const xhr = new window.XMLHttpRequest();

        //Sends the file to the server
        $.ajax({
            url: '/file',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                //What to do when the upload is in progress
                xhr.upload.addEventListener("progress", (event) => updateProgress(event, encodeId + time), false);
                return xhr;
            },
            //When the file is uploaded
            success: async function(response) {
              //Updates the progress of the uploads
              uploaded++;
              uploading--;
              document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;

              //Removes the progress bar from the item
              document.getElementById(encodeId + time + 'ContBar').remove();
  
              //Creates the action buttons in the item
              const uploadBtnsDiv = document.createElement('div');
              uploadBtnsDiv.classList.add('uploadBtnsDiv');
              uploadBtnsDiv.innerHTML = `\
                <button id='${time}Delete' class='uploadDeleteAndShareBtn deleteBtnFix'>\
                    Delete file
                    <i class="fa fa-trash" style='margin: 0 0.5vw;'></i>
                </button>\
                <button id='${time}Share' class='uploadDeleteAndShareBtn shareBtnFix'>\
                    Share file
                    <i class="fa-solid fa-share" style='margin: 0 0.5vw;'></i>
                </button>`;
              document.getElementById(encodeId + time + 'Item').appendChild(uploadBtnsDiv);
              document.getElementById(`${time}Delete`).onclick = () => deleteFile(response, encodeId + time + 'Item');
              document.getElementById(`${time}Share`).onclick = () => shareFile(file.name, response);
  
              //Updates some data in the item
              document.getElementById(encodeId + time + 'Btn').innerHTML = "<i class='fa-solid fa-check'></i>";
              document.getElementById(encodeId + time + 'Btn').style.backgroundColor = 'var(--b)';
              document.getElementById(encodeId + time + 'Btn').style.cursor = "default";
              document.getElementById(encodeId + time + 'Btn').onclick = "";
  
              //Moves the item to the done div
              doneDiv.insertBefore(document.getElementById(encodeId + time + 'Item'), doneDiv.firstChild);
  
              //Sends the stats to the server
              const endTime = performance.now();
              const duration = parseInt(endTime - startTime);
              await fetch(`/addStat?id=${UploadFilesMGVId}&time=${duration}&size=${file.size}&fileType=${(file.name).split('.')[(file.name).split('.').length - 1]}&date=${(new Date().toLocaleDateString())}`);
            },
            //Catches the failed uploads
            error: function() {
              //Checks if the error is due to a cancellation by the user
              if(!aborted) {
                  alert("Uploading the file failed (may be because a file with the same name already exists)");
                  failedUps++;

                  //Updates some data in the item and moves the item to the done div
                  uploadItem.style.paddingBottom = 0;
                  uploadItem.style.outlineColor = 'rgb(189, 0, 0)';
                  document.getElementById(encodeId + time + 'Title').style.color = 'rgb(189, 0, 0)';
                  document.getElementById(encodeId + time + 'ContBar').className = "uploadBarErrorItem";
                  document.getElementById(encodeId + time + 'ContBar').innerHTML = "Upload failed";
                  doneDiv.insertBefore(document.getElementById(encodeId + time + 'Item'), doneDiv.firstChild);
              } else aborted = false;
  
              //Updates the progress of the uploads
              uploading--;
              document.getElementById('uploadHistory').innerHTML--;
              document.getElementById("filesStatusMenu").innerHTML = `Uploaded files: ${uploaded} || Uploading: ${uploading} || Failed: ${failedUps}`;
            }
        });
    }
}

//The function that is called when the upload is in progress
function updateProgress(event, id) {
  if (event.lengthComputable && document.getElementById(id + 'P') != null) {
      const percentComplete = (event.loaded / event.total) * 100;
      document.getElementById(id + 'P').innerHTML = ((percentComplete == null) ? 100 : ((percentComplete.toFixed(2) == 100.00) ? 100 : percentComplete.toFixed(2))) + '%';
      document.getElementById(id + 'Bar').style.width = percentComplete + '%';
  }
}

//The function that is called when the user wants to delete a file
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
}

//The function that is called when the user clicks on the sharing button
async function shareFile(file, encodeFile) {
  if(globalFile != file) {
    globalFile = decodeURIComponent(file);
    globalFileLink = `${document.location.href.split(port)[0]}${port}/getFile/${UploadFilesMGVId}/${encodeFile}`;
  }
  document.getElementById('shareTitle').innerHTML = globalFile;
  document.getElementById('shareLinkInput').value = globalFileLink;
  document.getElementById('shareBox').classList.toggle('shareBoxOut');
}

//The function that is called when the user wants to share a file
async function shareFileAction() {
  await navigator.share({
    title: globalFile,
    text: `You got a link to the file ${globalFile}`,
    url: globalFileLink
  });
}

//The function that is called when the user wants to get the statistics
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
}