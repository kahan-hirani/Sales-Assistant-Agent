/**
 * Migration: Create Eval Logs Table
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('eval_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      session_id: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      groundedness: {
        type: Sequelize.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 1
        }
      },
      relevance: {
        type: Sequelize.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 1
        }
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 1
        }
      },
      flagged: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      reasoning: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      tools_called: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('eval_logs', ['user_id']);
    await queryInterface.addIndex('eval_logs', ['flagged']);
    await queryInterface.addIndex('eval_logs', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('eval_logs');
  }
};
