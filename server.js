require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const mysql = require('mysql2/promise');
const axios = require('axios'); // Importando o axios para fazer requisições HTTP

// Configurando o banco de dados
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.PORT
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
        reply.code(500).send(error);
    }
});

// Rota para adicionar um produto ao pedido (POST)
// No serviço de pedidos, atualizar a rota POST
fastify.post('/pedido', async (req, reply) => {
    const { produto_id, quantidade } = req.body;

    try {
        // Buscar produto
        const productResponse = await axios.get(`https://av3-arquitetura-de-projetos-production.up.railway.app/api/products/${produto_id}`);
        
        if (!productResponse.data) {
            return reply.code(404).send({ message: 'Produto não encontrado' });
        }

        const produto = productResponse.data;

        // Verificar estoque
        if (produto.stock < quantidade) {
            return reply.code(400).send({ message: 'Estoque insuficiente' });
        }

        // Criar pedido
        const [result] = await db.execute(
            'INSERT INTO pedido (produto_id, quantidade, valor_total) VALUES (?, ?, ?)',
            [produto.id, quantidade, produto.price * quantidade]
        );

        // Atualizar estoque
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

// Rota para obter todos os pedidos (GET ALL)
fastify.get('/pedido', async (req, reply) => {
    try {
        const [rows] = await db.query('SELECT * FROM pedido');
        reply.send(rows);
    } catch (error) {
        reply.code(500).send(error);
    }
});

// Rota para deletar um produto do pedido (DELETE)
fastify.delete('/pedido/:id', async (req, reply) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute('DELETE FROM pedido WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            reply.code(404).send({ message: 'Produto não encontrado no pedido' });
        } else {
            reply.send({ message: 'Produto removido do pedido', affectedRows: result.affectedRows });
        }
    } catch (error) {
        reply.code(500).send(error);
    }
});

// Rota para atualizar o estado dos pedidos (PUT)
fastify.put('/pedido/status/:id', async (req, reply) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const [result] = await db.execute(
            'UPDATE Pedido SET status = ? WHERE id = ?',
            [status, id]
        );
        if (result.affectedRows === 0) {
            reply.code(404).send({ message: 'Pedido não encontrado' });
        } else {
            reply.send({ message: 'Estado do pedido atualizado', affectedRows: result.affectedRows });
        }
    } catch (error) {
        reply.code(500).send(error);
    }
});

// Rota para atualizar a quantidade de produtos no pedido (PUT)
fastify.put('/pedido/quantidade/:id', async (req, reply) => {
    const { id } = req.params;
    const { quantidade } = req.body;

    try {
        const [result] = await db.execute(
            'UPDATE pedido SET quantidade = ? WHERE id = ?',
            [quantidade, id]
        );
        if (result.affectedRows === 0) {
            reply.code(404).send({ message: 'Produto não encontrado no pedido' });
        } else {
            reply.send({ message: 'Quantidade do produto atualizada', affectedRows: result.affectedRows });
        }
    } catch (error) {
        reply.code(500).send(error);
    }
});

// Iniciando o servidor
const start = async () => {
    try {
        await fastify.listen({ port: process.env.PORT});
        console.log(`Servidor rodando na porta ${process.env.PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
