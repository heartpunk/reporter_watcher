var exec    = require('child_process').exec,
    request = require('request'),
    fs      = require('fs'),
    moment  = require('moment');

var the_dir, auth_token, the_file_path, interval, watcher, day_switch_interval;

the_dir    = process.argv[2];
username   = process.argv[3];
auth_token = process.argv[4];

function do_it_all(path) {
  var data = JSON.parse(fs.readFileSync(path, 'utf8'));
  update_beeminder(data['snapshots'].length);
}

function update_beeminder(value) {
  console.log("about to update beeminder with value: " + value)
  var req = request.post('https://www.beeminder.com/api/v1/users/' + username +
                           '/goals/reporter/datapoints.json?auth_token=' + auth_token +
                           '&value=' + value +
                           '&timestamp=' + ((new Date()).getTime()/1000) +
                           '&comment=reporter_watcher',
                         function (error, response, body) {
    if (!error) {
      console.log('sent update ' + value);
      console.log('response was ' + response.body);
    }
    else {
      console.log('update ' + value + ' was rejected!');
    }
  });
  maintain_file_watcher();
}

function date_string(date) {
  return moment(date).format('YYYY-MM-DD');
}

function cur_file_path(date_string) {
  return process.argv[2] + "/" + date_string + '-reporter-export.json';
}

function deactivate_interval() {
  clearInterval(interval);
  interval = null;
}

function deactivate_watcher() {
  watcher.close();
  watcher = null;
}

function clear_watcher_and_interval() {
    if (watcher) { deactivate_watcher() };
    if (interval) { deactivate_interval() };
}

function activate_interval() {
  clear_watcher_and_interval();
  interval = setInterval(maintain_file_watcher, 60*1000*5);
}

function activate_watcher(path) {
  watcher = fs.watch(path, function(event, filename) {
    clear_watcher_and_interval();
    do_it_all(path);
  });
  var offset = (moment().add('d', 1) - moment()) + 10000;
  // we add ten seconds to the interval just to give a little extra room.
  day_switch_interval = setTimeout(maintain_file_watcher, offset);
}

function maintain_file_watcher() {
  var this_moments_file_path = cur_file_path(date_string(new Date()));

  if ( fs.statSync(this_moments_file_path).isFile() ) {
    activate_watcher(this_moments_file_path);
  }
  else { activate_interval(maintain_file_watcher); }
}

maintain_file_watcher()
