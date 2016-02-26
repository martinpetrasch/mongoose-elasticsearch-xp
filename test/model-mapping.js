var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("model-mapping", function () {

  utils.setup();

  it('should create an implicit mapping', function (done) {

    var deepEmbeddedSchema = new mongoose.Schema({
      _id: false,
      dn: Number
    });

    var embeddedSchema = new mongoose.Schema({
      _id: false,
      key: String,
      deep: [deepEmbeddedSchema]
    });

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      joined: Date,
      optin: {type: Boolean, default: true},
      tags: [String],
      plain: {
        x: String,
        y: Number,
        z: Boolean
      },
      embedded: embeddedSchema
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name', 'age', 'joined', 'tags', 'optin', 'plain', 'embedded');
        expect(properties.name.type).to.be.equal('string');
        expect(properties.age.type).to.be.equal('double');
        expect(properties.joined.type).to.be.equal('date');
        expect(properties.tags.type).to.be.equal('string');
        expect(properties.optin.type).to.be.equal('boolean');

        expect(properties.plain.properties).to.have.all.keys('x', 'y', 'z');
        expect(properties.plain.properties.x.type).to.be.equal('string');
        expect(properties.plain.properties.y.type).to.be.equal('double');
        expect(properties.plain.properties.z.type).to.be.equal('boolean');

        expect(properties.embedded.properties).to.have.all.keys('deep', 'key');
        expect(properties.embedded.properties.key.type).to.be.equal('string');

        expect(properties.embedded.properties.deep.properties).to.have.all.keys('dn');
        expect(properties.embedded.properties.deep.properties.dn.type).to.be.equal('double');

        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should create an explicit mapping', function (done) {

    var deepImplicitEmbeddedSchema = new mongoose.Schema({
      _id: false,
      dn: Number
    });

    var embeddedSchema = new mongoose.Schema({
      _id: false,
      key: String,
      deep1: {type: [deepImplicitEmbeddedSchema], es_indexed: true},
      deep2: {type: [deepImplicitEmbeddedSchema]}
    });

    var implicitEmbeddedSchema = new mongoose.Schema({
      _id: false,
      anyKey: String
    });

    var UserSchema = new mongoose.Schema({
      name: {type: String, es_indexed: true},
      age: Number,
      joined: {type: Date},
      optin: {type: Boolean, default: true, es_indexed: true},
      tags: {type: [String], es_indexed: true},
      plain: { // plain object so, without es_indexed would not be included
        x: String,
        y: Number,
        z: Boolean
      },
      embedded1: {type: embeddedSchema, es_indexed: false}, // needed, because of embedded1.deep1.es_indexed == true
      embedded2: {type: embeddedSchema, es_indexed: true},
      embedded3: implicitEmbeddedSchema // no explicit es_indexed, so, would not be included
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name', 'tags', 'optin', 'embedded2');
        expect(properties.name.type).to.be.equal('string');
        expect(properties.tags.type).to.be.equal('string');
        expect(properties.optin.type).to.be.equal('boolean');

        expect(properties.embedded2.properties).to.have.all.keys('deep1');

        expect(properties.embedded2.properties.deep1.properties).to.have.all.keys('dn');
        expect(properties.embedded2.properties.deep1.properties.dn.type).to.be.equal('double');
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

});
