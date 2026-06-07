module.exports = (sequelize, DataTypes) => {
  const EvalLog = sequelize.define('EvalLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      index: true,
      field: 'user_id'
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'session_id'
    },
    groundedness: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        max: 1
      }
    },
    relevance: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        max: 1
      }
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
        max: 1
      }
    },
    flagged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    reasoning: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    toolsCalled: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'tools_called'
    }
  }, {
    tableName: 'eval_logs',
    timestamps: true,
    underscored: true
  });

  return EvalLog;
};
