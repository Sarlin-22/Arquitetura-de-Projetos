require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const mysql = require('mysql2/promise');
const axios = require('axios');

// Configurando o banco de dados
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// Rota para obter detalhes de um pedido específico (GET)
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

// Rota para adicionar um produto ao pedido (POST)
fastify.post('/pedido', async (req, reply) => {
    const { produto_id, quantidade } = req.body;

    // Verifique se o produto_id foi passado corretamente e é válido
    if (!produto_id || isNaN(produto_id)) {
        return reply.code(400).send({ message: 'Produto não encontrado ou id inválido' });
    }

    try {
        // Buscar produto utilizando produto_id corretamente na URL
        const productResponse = await axios.get(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}`
        );

        // Verificar se o produto foi encontrado
        if (!productResponse.data) {
            return reply.code(404).send({ message: 'Produto não encontrado' });
        }

        const produto = productResponse.data;

        // Verificar estoque
        if (produto.stock < quantidade) {
            return reply.code(400).send({ message: 'Estoque insuficiente' });
        }

        // Criar pedido no banco de dados
        const [result] = await db.execute(
            'INSERT INTO pedido (produto_id, quantidade, valor_total) VALUES (?, ?, ?)',
            [produto.id, quantidade, produto.price * quantidade]
        );

        // Atualizar estoque no sistema externo
        await axios.put(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}/stock?quantity=${quantidade}`
        );

        // Retornar resposta ao cliente
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

// Rota para obter todos os pedidos (GET ALL)
fastify.get('/pedido', async (req, reply) => {
    try {
        const [rows] = await db.query('SELECT * FROM pedido');
        reply.send(rows);
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao buscar pedidos', error: error.message });
    }
});

// Rota para deletar um produto do pedido (DELETE)
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

// Rota para atualizar a quantidade de produtos no pedido (PUT)
fastify.put('/pedido/quantidade/:id', async (req, reply) => {
    const { id } = req.params;
    const { quantidade } = req.body;

    try {
        const [pedido] = await db.query('SELECT * FROM pedido WHERE id = ?', [id]);

        if (pedido.length === 0) {
            return reply.code(404).send({ message: 'Pedido não encontrado' });
        }

        const produto_id = pedido[0].produto_id;

        // Buscar o produto para verificar estoque
        const productResponse = await axios.get(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}`
        );

        if (!productResponse.data) {
            return reply.code(404).send({ message: 'Produto não encontrado na API' });
        }

        const produto = productResponse.data;

        if (produto.stock < quantidade) {
            return reply.code(400).send({ message: 'Estoque insuficiente para atualizar a quantidade' });
        }

        // Atualizar a quantidade do pedido
        const valorTotal = produto.price * quantidade;
        const [result] = await db.execute(
            'UPDATE pedido SET quantidade = ?, valor_total = ? WHERE id = ?',
            [quantidade, valorTotal, id]
        );

        reply.send({ message: 'Quantidade atualizada com sucesso', affectedRows: result.affectedRows });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao atualizar pedido', error: error.message });
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
