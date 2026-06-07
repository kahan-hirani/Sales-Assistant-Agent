/**
 * Conversation Model
 * Stores conversation turns between users and the AI assistant
 */

module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
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
      type: DataTypes.UUID,
      allowNull: false,
      field: 'session_id'
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    toolsCalled: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'tools_called'
    }
  }, {
    tableName: 'conversations',
    timestamps: true,
    underscored: true
  });

  return Conversation;
};
