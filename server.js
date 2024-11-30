const fastify = require('fastify')({ logger: true });
const mysql = require('mysql2/promise');

// Configurando o banco de dados
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345678',
    database: 'pedidos',
});
/*precosse script = new precosse
idproduto = script.getproduto_id(nome)*/
// Rota para obter detalhes de um produto específico (GET)
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

// Rota para adicionar um produto ao carrinho (POST)
fastify.post('/pedido', async (req, reply) => {
    const { produto_id, quantidade } = req.body;

    try {
        const [result] = await db.execute(
            'INSERT INTO pedido (produto_id, quantidade) VALUES (?, ?)',
            [produto_id, quantidade]
        );
        reply.code(201).send({ id: result.insertId, message: 'Produto adicionado ao pedido' });
    } catch (error) {
        reply.code(500).send(error);
    }
});

// Rota para obter todos os produtos do carrinho (GET ALL)
fastify.get('/pedido', async (req, reply) => {
    try {
        const [rows] = await db.query('SELECT * FROM pedido');
        reply.send(rows);
    } catch (error) {
        reply.code(500).send(error);
    }
});

// Rota para deletar um produto do carrinho (DELETE)
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

// Rota para atualizar a quantidade de produtos no carrinho (PUT)
fastify.put('/pedido/quantidade/:id', async (req, reply) => {
    const { id } = req.params;
    const { quantidade } = req.body;

    try {
        const [result] = await db.execute(
            'UPDATE pedido SET quantidade = ? WHERE id = ?',
            [quantidade, id]
        );
        if (result.affectedRows === 0) {
            reply.code(404).send({ message: 'Produto não encontrado no carrinho' });
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
        await fastify.listen({ port: 3000 });
        console.log('Servidor rodando na porta 3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();