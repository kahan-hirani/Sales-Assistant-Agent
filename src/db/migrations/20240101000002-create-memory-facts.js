module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('memory_facts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      fact: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      source_session_id: {
        type: Sequelize.STRING(100),
        allowNull: true
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

    await queryInterface.addIndex('memory_facts', ['user_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('memory_facts');
  }
};
