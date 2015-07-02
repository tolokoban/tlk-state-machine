'use strict';

var FS = require("fs");
var Path = require("path");
var StateMachine = require("../src/tlk-state-machine");

function read(name) {
  var filename = Path.join(__dirname, "cases/" + name);
  if (FS.existsSync(filename)) {
    return FS.readFileSync(filename).toString();
  }
  throw Error("Unable to find case's file: " + filename);
}

function extract(arr, idx) {
  var a = Math.max(0, idx - 2);
  var b = Math.min(idx + 3, arr.length);
  var i, txt, out = '';
  for (i = a ; i < b ; i++) {
    txt = "" + (1 + i);
    while (txt.length < 6) txt = ' ' + txt;
    out += txt + ": " + arr[i] + "\n";
  }
  return out;
}

describe("State Machine", function() {
  describe("HTML parsing", function() {
    it("should build tree from HTML source", function() {
      var Tree = {
        VOID: 0,
        TAG: 1,
        TEXT: 2,
        COMMENT: 3,
        DIRECTIVE: 4,
        CDATA: 5,
        ENTITY: 6
      };

      function pushText() {
        var cursor = this.vars.cursor || 0;
        var text = this.source.substr(cursor, this.index - cursor);
        console.log('"' + text + '"');
        this.vars.nodes.push(
          {node: "TEXT", text: text}
        );
      }

      function setCursor() {
        this.vars.cursor = this.index + 1;
      }

      var rules = {
        TEXT: [
          ["<", "OPEN_TAG", pushText]
        ],
        OPEN_TAG: [
          [">", "TEXT", setCursor]
        ]
      };

      var source = "Hello <b>World</b>!";

      var ctx = StateMachine.run(rules, source, {cursor: 0, nodes: []});
      if (ctx.state == "TEXT") {
        pushText();
      }
console.info("[tlk-state-machine.spec] ctx=...", ctx);
      console.info("[tlk-state-machine.spec] ctx.vars.nodes=...", ctx.vars.nodes);
    });
  });

  describe("for C-style comments removing", function() {
    beforeAll(function() {
      var flush = function() {
        var v = this.vars;
        v.output += this.source.substr(v.cursor, this.index - v.cursor);
        v.cursor = this.index;
      };
      var reset = function() {
        this.vars.cursor = this.index + 1;
      };
      var skip = function() {
        this.index++;
      };
      var rules = {
        "0": [
          ["/", "Slash", flush],
          ["'", "SimpleQuote"],
          ['"', "DoubleQuote"],
          ["\\", "0", skip]
        ],
        "Escape": ["0"],
        "Slash": [
          ["/", "LineComment", flush],
          ["*", "BlocComment", flush],
          ["0"]
        ],
        "SimpleQuote": [
          ["'", "0"],
          ["\\", "SimpleQuote", skip]
        ],
        "DoubleQuote": [
          ['"', "0"],
          ["\\", "DoubleQuote", skip]
        ],
        "LineComment": [
          ["\n", "0", reset],
          reset
        ],
        "BlocComment": [
          ["*", "BlocCommentEnd"],
          reset
        ],
        "BlocCommentEnd": [
          ["/", "0", reset],
          [null, "BlocComment", reset]
        ]
      };
      this.check = function(a, b) {
        if (typeof b === 'undefined') b = a;
        var ctx = StateMachine.run(rules, a, {cursor: 0, output: ""});
        ctx.vars.output += a.substr(ctx.vars.cursor);
        var r = ctx.vars.output;
        var B = b.split("\n");
        var R = r.split("\n");
        if (B.length < 4 && R.length < 4) {
          expect(r).toBe(b);
        } else {
          var i, lineB, lineR;
          for (i = 0 ; i < B.length ; i++) {
            lineB = B[i];
            lineR = R[i];
            if (lineB != lineR) {
              throw Error("Expected\n" + extract(B, i) + "\nbut found\n" + extract(R, i));
            }
          }
          expect(R).toEqual(B);
        }
      };
    });

    it("should deal with bad endings", function() {
      this.check("bill//bob", "bill");
      this.check("bill/*bob", "bill");
    });

    it("should deal with single slashes", function() {
      this.check("  float r = g.y + g.x * time / 900.0;\n");
      this.check("27 / 9 = 3");
      this.check("/ *");
      this.check("A/B\nC//D\nE", "A/B\nCE");
      this.check(
        "Vive / l artiste\nBob // comment.\nYoupi",
        "Vive / l artiste\nBob Youpi"
      );
    });

    it("should deal with strings", function() {
      this.check("This 'is // fun', is it?");
      this.check('This "is // fun", is it?');
    });

    it("should deal with complex files", function() {
      for(var i = 0 ; i < 3 ; i++) {
        this.check(read("comments." + i + ".in"), read("comments." + i + ".out"));
      }
    });
  });
});
