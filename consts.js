module.exports = {
  STATE: {
    PREFLIGHT: 1,
    OSH: 2,
    PUSH: 3,
    TAXI: 4,
    CLIMB: 5,
    CRUISE: 6,
    DESCENT: 7,
    HOLD: 8,
    APPROACH: 9,
    ARRIVAL: 10,
  },
  EVENT: {
    TAXI: 0,
    TAKEOFF: 1,
    ABORTTAKEOFF: 2,
    TOPOFCLIMB: 3,
    TOPOFDESCENT: 4,
    LANDING: 5,
    GOAROUND: 6,
    DIVERT: 7,
  },
  ID: {
    RESUME_FLIGHT: 2,
    NEW_FLIGHT: 1,
    ALREADY_ASSIGNED: 0,
  },
};
