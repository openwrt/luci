%name pluralParse
%token_type {int}
%extra_argument {struct parse_state *s}

%right T_QMARK.
%left T_OR.
%left T_AND.
%left T_EQ T_NE.
%left T_LT T_LE T_GT T_GE.
%left T_ADD T_SUB.
%left T_MUL T_DIV T_MOD.
%right T_NOT.
%nonassoc T_COLON T_N T_LPAREN T_RPAREN.

%include {
#include <assert.h>

struct parse_state {
	int num;
	int res;
};
}

input ::= expr(A).										{ s->res = A; }

expr(A) ::= expr(B) T_QMARK expr(C) T_COLON expr(D).	{ A = B ? C : D; }
expr(A) ::= expr(B) T_OR expr(C).						{ A = B || C; }
expr(A) ::= expr(B) T_AND expr(C).						{ A = B && C; }
expr(A) ::= expr(B) T_EQ expr(C).						{ A = B == C; }
expr(A) ::= expr(B) T_NE expr(C).						{ A = B != C; }
expr(A) ::= expr(B) T_LT expr(C).						{ A = B < C; }
expr(A) ::= expr(B) T_LE expr(C).						{ A = B <= C; }
expr(A) ::= expr(B) T_GT expr(C).						{ A = B > C; }
expr(A) ::= expr(B) T_GE expr(C).						{ A = B >= C; }
expr(A) ::= expr(B) T_ADD expr(C).						{ A = B + C; }
expr(A) ::= expr(B) T_SUB expr(C).						{ A = B - C; }
expr(A) ::= expr(B) T_MUL expr(C).						{ A = B * C; }
expr(A) ::= expr(B) T_DIV expr(C).						{ A = B / C; }
expr(A) ::= expr(B) T_MOD expr(C).						{ A = B % C; }
expr(A) ::= T_NOT expr(B).								{ A = !B; }
expr(A) ::= T_N.										{ A = s->num; }
expr(A) ::= T_NUM(B).									{ A = B; }
expr(A) ::= T_LPAREN expr(B) T_RPAREN.					{ A = B; }
