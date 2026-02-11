export const INITIAL_VERILOG_CODE = `module traffic_light_controller (
    input clk,
    input rst_n,
    input timer_done,
    output reg [1:0] light_color // 00: Green, 01: Yellow, 10: Red
);

    // State Encoding
    localparam IDLE      = 2'b00;
    localparam GREEN     = 2'b01;
    localparam YELLOW    = 2'b10;
    localparam RED       = 2'b11;

    reg [1:0] current_state, next_state;

    // Sequential Logic
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            current_state <= IDLE;
        else
            current_state <= next_state;
    end

    // Combinational Logic
    always @(*) begin
        next_state = current_state;
        light_color = 2'b00; // Default off

        case (current_state)
            IDLE: begin
                next_state = GREEN;
            end

            GREEN: begin
                light_color = 2'b00; // Green
                if (timer_done)
                    next_state = YELLOW;
            end

            YELLOW: begin
                light_color = 2'b01; // Yellow
                next_state = RED;
            end

            RED: begin
                light_color = 2'b10; // Red
                if (timer_done)
                    next_state = GREEN;
            end
            
            default: next_state = IDLE;
        endcase
    end

endmodule`;
