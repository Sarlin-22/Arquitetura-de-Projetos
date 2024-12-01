require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const mysql = require('mysql2/promise');
const axios = require('axios');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// Obter detalhes de um so pedido
fastify.get('/pedido/:id', async (req, reply) => {
    const { id } = req.params;

    try {
        const [rows] = await db.query('SELECT * FROM pedido WHERE id = ?', [id]);
        if (rows.length === 0) {
            reply.code(404).send({ message: 'Pedido não encontrado' });
        } else {
            reply.send(rows[0]);
        }
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao buscar pedido', error: error.message });
    }
});

// Adiciona um produto ao pedido
fastify.post('/pedido', async (req, reply) => {
    const { produto_id, quantidade } = req.body;

    // Verifica se o produto_id e valido
    if (!produto_id || isNaN(produto_id)) {
        return reply.code(400).send({ message: 'Produto não encontrado ou id inválido' });
    }

    try {
        // Buscar produto da tabela do leonardo
        const productResponse = await axios.get(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}`
        );

        // Verifica encontrou o produto
        if (!productResponse.data) {
            return reply.code(404).send({ message: 'Produto não encontrado' });
        }

        const produto = productResponse.data;

        // Verifica o estoque
        if (produto.stock < quantidade) {
            return reply.code(400).send({ message: 'Estoque insuficiente' });
        }

        // Criar pedido no banco de dados
        const [result] = await db.execute(
            'INSERT INTO pedido (produto_id, quantidade, valor_total) VALUES (?, ?, ?)',
            [produto.id, quantidade, produto.price * quantidade]
        );

        // Atualiza o estoque do leonardo
        await axios.put(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}/stock?quantity=${quantidade}`
        );

        reply.code(201).send({
            id: result.insertId,
            message: 'Pedido criado e estoque atualizado',
            produto: produto
        });

    } catch (error) {
        console.error(error);
        reply.code(500).send({
            message: 'Erro ao processar pedido',
            error: error.message
        });
    }
});

// Obter todos os pedidos
fastify.get('/pedido', async (req, reply) => {
    try {
        const [rows] = await db.query('SELECT * FROM pedido');
        reply.send(rows);
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao buscar pedidos', error: error.message });
    }
});

// Deletar um produto do pedido
fastify.delete('/pedido/:id', async (req, reply) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute('DELETE FROM pedido WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            reply.code(404).send({ message: 'Pedido não encontrado' });
        } else {
            reply.send({ message: 'Pedido deletado com sucesso' });
        }
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao deletar pedido', error: error.message });
    }
});

// Iniciando o servidor
const start = async () => {
    try {
        await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
        console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
