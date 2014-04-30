var exec    = require('child_process').exec,
    request = require('request'),
    fs      = require('fs'),
    moment  = require('moment');

var the_dir, auth_token, the_file_path, interval, watcher, day_switch_interval;

the_dir    = process.argv[2];
username   = process.argv[3];
auth_token = process.argv[4];

function log(message) {
  console.log(moment().format() + ' ' + message)
}

function daily_reporter_data_to_update_value(data) {
  return data['snapshots'].length;
}

function do_it_all(path) {
  log("doing it all");

  update_beeminder(
    daily_reporter_data_to_update_value(
      JSON.parse(fs.readFileSync(path, 'utf8'))
    )
  );
}

function update_beeminder(value) {
  log("about to update beeminder with value: " + value)
  var req = request.post('https://www.beeminder.com/api/v1/users/' + username +
                           '/goals/reporter/datapoints.json?auth_token=' + auth_token +
                           '&value=' + value +
                           '&timestamp=' + ((new Date()).getTime()/1000) +
                           '&comment=reporter_watcher',
                         function (error, response, body) {
    if (!error) {
      log('sent update ' + value);
      log('response was ' + response.body);
    }
    else {
      log('update ' + value + ' was rejected!');
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
  log("clearing watcher and interval");
  if (watcher) { deactivate_watcher() };
  if (interval) { deactivate_interval() };
}

function activate_interval() {
  clear_watcher_and_interval();
  log("setting up an interval to periodically check if today's file has been created.")
  interval = setInterval(maintain_file_watcher, 60*1000*5);
}

function activate_watcher(path) {
  log("setting up the watcher for path=" + path);
  watcher = fs.watch(path, function(event, filename) {
    clear_watcher_and_interval();
    do_it_all(path);
  });
}

function time_to_midnight(current_time) {
  return (moment(current_time).startOf('day').add('day', 1) - current_time) + 10000;
  // we add ten seconds to the interval just to give a little extra room.
}

function setup_midnight_switchover_interval() {
  var offset = time_to_midnight(new Date());
  log("we'll switch over to the next day's file in approximately " +
              (offset/1000) + " seconds");
  clearTimeout(day_switch_interval);
  day_switch_interval = setTimeout(maintain_file_watcher, offset);
}

function file_watcher_maintenance_logic(current_file_path, file_exists, interval) {
  if (file_exists) {
    return {
      'type':'watch',
      'path': current_file_path
    };
  }
  else {
    if (interval) {
      return {
        'type': 'pass'
      }
    }
    else {
      return {
        'type': 'wait'
      };
    }
  }
}

function maintain_file_watcher() {
  var this_moments_file_path = cur_file_path(date_string(new Date()));
  log("the current file path is " + this_moments_file_path);
  var file_exists = fs.existsSync(this_moments_file_path) && fs.statSync(this_moments_file_path).isFile();

  var command = file_watcher_maintenance_logic(this_moments_file_path, file_exists, day_switch_interval);

  if ( command['type'] == 'watch' ) {
    log("there is a file at the current file path");
    activate_watcher(command['path']);
    setup_midnight_switchover_interval();
  }
  else if (command['type'] == 'wait') {
    log("no file at the current file path yet, keep waiting.");
    activate_interval(maintain_file_watcher);
  }
}

log("starting up!");
maintain_file_watcher();
