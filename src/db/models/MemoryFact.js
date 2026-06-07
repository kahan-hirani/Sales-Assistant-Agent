module.exports = (sequelize, DataTypes) => {
  const MemoryFact = sequelize.define('MemoryFact', {
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
    fact: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sourceSessionId: {
      type: DataTypes.STRING,
      field: 'source_session_id'
    }
  }, {
    tableName: 'memory_facts',
    timestamps: true,
    underscored: true
  });

  return MemoryFact;
};
