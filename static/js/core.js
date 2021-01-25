function requestJson(file, callback) {
  let xhr = new XMLHttpRequest();
  xhr.open("GET", file);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.responseType = "json";
  xhr.onload = function () {
    if (xhr.status !== 200) return;
    callback(xhr.response);
  };
  xhr.send();
}
