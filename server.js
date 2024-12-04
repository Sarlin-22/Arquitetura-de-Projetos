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

fastify.get('/pedido', async (req, reply) => {
    try {
        const [rows] = await db.query('SELECT * FROM pedido');
        reply.send(rows);
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao buscar pedidos', error: error.message });
    }
});

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

fastify.put('/pedido/quantidade/:id', async (req, reply) => {
    const { id } = req.params;
    const { quantidade } = req.body;

    try {
        const [pedido] = await db.query('SELECT * FROM pedido WHERE id = ?', [id]);

        if (pedido.length === 0) {
            return reply.code(404).send({ message: 'Pedido não encontrado' });
        }

        const produto_id = pedido[0].produto_id;
        const quantidadeAnterior = pedido[0].quantidade;

        // Busca o produto na API
        const productResponse = await axios.get(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}`
        );

        if (!productResponse.data) {
            return reply.code(404).send({ message: 'Produto não encontrado na API' });
        }

        const produto = productResponse.data;

        // Verificar se a estoque suficiente para a quantidade
        if (produto.stock < (quantidade - quantidadeAnterior)) {
            return reply.code(400).send({ message: 'Estoque insuficiente para atualizar a quantidade' });
        }

        // Atualiza a quantidade e o valor_total
        const valorTotal = produto.price * quantidade;
        const [result] = await db.execute(
            'UPDATE pedido SET quantidade = ?, valor_total = ? WHERE id = ?',
            [quantidade, valorTotal, id]
        );

        // Atualizar o estoque na API
        const quantidadeAlterada = quantidade - quantidadeAnterior;
        await axios.put(
            `https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}/stock?quantity=${quantidadeAlterada}`
        );

        reply.send({
            message: 'Quantidade atualizada com sucesso e estoque ajustado',
            affectedRows: result.affectedRows
        });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: 'Erro ao atualizar pedido', error: error.message });
    }
});

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