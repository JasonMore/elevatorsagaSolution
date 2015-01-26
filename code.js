/*
 NOTE: this code only handles the MAX WAIT TIME levels
 */

{
  init: function (elevators, floors) {
    // keep track of the requests for travel
    var goingUp = [];
    var goingDown = [];

    // a worker tick that checks how to dispatch elevators
    setTimeout(workFloorQueues);
    function workFloorQueues() {
      goingUp = workFloorQueue(goingUp, 'up');
      goingDown = workFloorQueue(goingDown, 'down');

      // recursively call this func
      setTimeout(workFloorQueues);

      function workFloorQueue(queue, direction) {
        var floorsNotHandled = [];

        // process elevator requests as FIFO
        while (queue.length) {
          var floorNum = queue.shift();
          var success = handleFloorRequest(floorNum, direction);
          if (!success) {
            floorsNotHandled.push(floorNum);
          }
        }

        // if the floor wasn't dispatched an elevator, try again
        return floorsNotHandled;
      }

      function handleFloorRequest(floorNum, direction) {
        // sometimes the below checks get fiddly so I tend to turn them off an on when needed
        var idleElevators = [];

        // try to find an elevator already on this floor
        if (idleElevators.length == 0) {
          idleElevators = elevators.filter(function (elevator) {
            if (direction == 'up') {
              return elevator.goingUpIndicator() && elevator.currentFloor() == floorNum && elevator.loadFactor() < 0.3;
            }
            else if (direction == 'down') {
              return elevator.goingDownIndicator() && elevator.currentFloor() == floorNum && elevator.loadFactor() < 0.3;
            }
          });
        }
        // then find an idle elevator
        if (idleElevators.length == 0) {
          idleElevators = elevators.filter(function (elevator) {
            return elevator.isIdle();
          });
        }

        // no elevators available, try again later
        if (idleElevators.length == 0) return false;

        // find the elevator closest to this floor
        var closestElevator = idleElevators.reduce(function (prev, curr) {
          return (Math.abs(curr.currentFloor() - floorNum) < Math.abs(prev.currentFloor() - floorNum) ? curr : prev);
        });

        // send the elevator there
        closestElevator.goToFloor(floorNum, true);

        // turn the correct light on for the elevator
        if (direction == 'up') {
          closestElevator.goingUp();
        }
        else {
          closestElevator.goingDown();
        }

        console.log('elevator: ', closestElevator.number, ' going to: ', floorNum);
        return true;
      }
    }

    elevators.forEach(function (elevator, index) {
      elevator.number = index;

      elevator.on("idle", function () {
        elevator.resetLights()
      });

      elevator.on("floor_button_pressed", function (floorNum) {
        // creates a queue of floors to go to
        elevator.buttonPress(floorNum);

        // try to close the doors, but lets people sneak in if they are fast enough
        elevator.closeDoors();

        // set the lights
        if (floorNum > elevator.currentFloor()) {
          elevator.goingUp();
        }
        else {
          elevator.goingDown();
        }
      });

      // when someone presses a button, place it in the queue
      elevator.buttonPress = function (floorNum) {
        var queueSpot = _.sortedIndex(elevator.destinationQueue, floorNum);
        elevator.destinationQueue.splice(queueSpot, 0, floorNum);

        console.log('elevator: ', elevator.number, ' button pressed: ', floorNum, elevator.destinationQueue);
      };

      // try to close the doors and start moving the elevator.
      // Debounces in case someone else jumps in
      elevator.closeDoors = _.debounce(function () {
        elevator.destinationQueue = _(elevator.destinationQueue).uniq().sortBy().value();

        if (elevator.goingDownIndicator()) {
          elevator.destinationQueue = elevator.destinationQueue.reverse();
        }

        elevator.checkDestinationQueue();
        console.log('elevator: ', elevator.number, 'leaving: ', elevator.destinationQueue);
        elevator.queue = [];
      }, 35);

      elevator.isIdle = function () {
        // if empty and not going anywhere, its idle
        return !(elevator.loadFactor() || elevator.destinationQueue.length);
      };

      elevator.goingUp = function () {
        elevator.goingUpIndicator(true);
        elevator.goingDownIndicator(false);
      };

      elevator.goingDown = function () {
        elevator.goingUpIndicator(false);
        elevator.goingDownIndicator(true);
      };

      // marks as available to go any direction if the elevator happens to be idleing on a floor
      elevator.resetLights = function () {
        elevator.goingUpIndicator(true);
        elevator.goingDownIndicator(true);
      };
    });

    floors.forEach(function (floor, index) {
      floor.number = index;

      floor.on("up_button_pressed", function () {
        goingUp.push(floor.number);
      });

      floor.on("down_button_pressed", function () {
        goingDown.push(floor.number);
      });
    });
  }
,
  update: function (dt, elevators, floors) {
    // We normally don't need to do anything here
  }
}